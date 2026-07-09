let HttpError: typeof import("../../../src/_core/resilience/retry").HttpError;
let getMeteringBuffer: typeof import("../../../src/_core/metering/buffer").getMeteringBuffer;
let resetMeteringBuffer: typeof import("../../../src/_core/metering/buffer").resetMeteringBuffer;
let flushMeteringBuffer: typeof import("../../../src/_core/metering/buffer").flushMeteringBuffer;
let getBufferStats: typeof import("../../../src/_core/metering/buffer").getBufferStats;
let shouldBufferError: typeof import("../../../src/_core/metering/buffer").shouldBufferError;
type BufferEntry = import("../../../src/_core/metering/buffer").BufferEntry;

const originalFetch = global.fetch;

function createEntry(overrides: Partial<BufferEntry> = {}): BufferEntry {
  return {
    url: "https://api.revenium.ai/meter/v2/ai/completions",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "hak_test",
      "Idempotency-Key": `key-${Math.random().toString(36).slice(2)}`,
    },
    body: JSON.stringify({ model: "gpt-4", totalTokenCount: 100 }),
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  jest.resetModules();
  const retry = await import("../../../src/_core/resilience/retry");
  HttpError = retry.HttpError;
  const buffer = await import("../../../src/_core/metering/buffer");
  getMeteringBuffer = buffer.getMeteringBuffer;
  resetMeteringBuffer = buffer.resetMeteringBuffer;
  flushMeteringBuffer = buffer.flushMeteringBuffer;
  getBufferStats = buffer.getBufferStats;
  shouldBufferError = buffer.shouldBufferError;
});

afterEach(() => {
  resetMeteringBuffer();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("MeteringBuffer", () => {
  it("pushes entries and reports stats", () => {
    const buf = getMeteringBuffer();
    buf.push(createEntry());
    buf.push(createEntry());

    const stats = getBufferStats();
    expect(stats.size).toBe(2);
    expect(stats.totalBuffered).toBe(2);
    expect(stats.totalEvicted).toBe(0);
  });

  it("evicts oldest entry when buffer is full", () => {
    const buf = getMeteringBuffer();
    buf.configure(2, 30_000);

    const entry1 = createEntry({ body: "first" });
    const entry2 = createEntry({ body: "second" });
    const entry3 = createEntry({ body: "third" });

    buf.push(entry1);
    buf.push(entry2);
    buf.push(entry3);

    const stats = getBufferStats();
    expect(stats.size).toBe(2);
    expect(stats.totalEvicted).toBe(1);
    expect(stats.totalBuffered).toBe(3);
  });

  it("flushes events to backend successfully", async () => {
    jest.useFakeTimers();
    const buf = getMeteringBuffer();
    const entry = createEntry();
    buf.push(entry);

    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 201,
      } as Response),
    );
    global.fetch = mockFetch;

    await flushMeteringBuffer();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(entry.url, {
      method: "POST",
      headers: entry.headers,
      body: entry.body,
      signal: expect.any(AbortSignal),
    });

    const stats = getBufferStats();
    expect(stats.size).toBe(0);
    expect(stats.totalFlushed).toBe(1);
    jest.useRealTimers();
  });

  it("preserves original Idempotency-Key on flush", async () => {
    jest.useFakeTimers();
    const buf = getMeteringBuffer();
    const originalKey = "original-idempotency-key-123";
    buf.push(createEntry({ headers: { "Idempotency-Key": originalKey, "x-api-key": "hak_test" } }));

    const mockFetch = jest.fn(() => Promise.resolve({ ok: true, status: 201 } as Response));
    global.fetch = mockFetch;

    await flushMeteringBuffer();

    const call = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const sentHeaders = call[1].headers as Record<string, string>;
    expect(sentHeaders["Idempotency-Key"]).toBe(originalKey);
    jest.useRealTimers();
  });

  it("stops flushing on first error", async () => {
    jest.useFakeTimers();
    const buf = getMeteringBuffer();
    buf.push(createEntry({ body: "event-1" }));
    buf.push(createEntry({ body: "event-2" }));
    buf.push(createEntry({ body: "event-3" }));

    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve({ ok: false, status: 503 } as Response);
      }
      return Promise.resolve({ ok: true, status: 201 } as Response);
    });

    await flushMeteringBuffer();

    expect(callCount).toBe(2);
    const stats = getBufferStats();
    expect(stats.size).toBe(2);
    expect(stats.totalFlushed).toBe(1);
    jest.useRealTimers();
  });

  it("discards entries older than 24 hours", async () => {
    jest.useFakeTimers();
    const buf = getMeteringBuffer();
    const oldEntry = createEntry({ createdAt: Date.now() - 25 * 60 * 60 * 1000 });
    const freshEntry = createEntry({ body: "fresh" });

    buf.push(oldEntry);
    buf.push(freshEntry);

    const mockFetch = jest.fn(() => Promise.resolve({ ok: true, status: 201 } as Response));
    global.fetch = mockFetch;

    await flushMeteringBuffer();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const stats = getBufferStats();
    expect(stats.totalExpired).toBe(1);
    expect(stats.totalFlushed).toBe(1);
    expect(stats.size).toBe(0);
    jest.useRealTimers();
  });

  it("drops terminal errors and tracks them separately from flushed", async () => {
    jest.useFakeTimers();
    const buf = getMeteringBuffer();
    buf.push(createEntry());

    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401 } as Response));

    await flushMeteringBuffer();

    const stats = getBufferStats();
    expect(stats.size).toBe(0);
    expect(stats.totalFlushed).toBe(0);
    expect(stats.totalDropped).toBe(1);
    jest.useRealTimers();
  });

  it("prevents concurrent flushes", async () => {
    jest.useFakeTimers();
    const buf = getMeteringBuffer();
    buf.push(createEntry());

    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 201 } as Response));

    const flush1 = flushMeteringBuffer();
    const flush2 = flushMeteringBuffer();

    await flush1;
    await flush2;

    expect(global.fetch).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("handles network errors during flush gracefully", async () => {
    jest.useFakeTimers();
    const buf = getMeteringBuffer();
    buf.push(createEntry());

    global.fetch = jest.fn(() => Promise.reject(new TypeError("fetch failed")));

    await flushMeteringBuffer();

    const stats = getBufferStats();
    expect(stats.size).toBe(1);
    expect(stats.totalFlushed).toBe(0);
    jest.useRealTimers();
  });

  it("resets all state", () => {
    const buf = getMeteringBuffer();
    buf.push(createEntry());
    buf.push(createEntry());

    resetMeteringBuffer();

    const stats = getBufferStats();
    expect(stats.size).toBe(0);
    expect(stats.totalBuffered).toBe(0);
  });
});

describe("shouldBufferError", () => {
  it("returns true for circuit breaker OPEN error", () => {
    expect(shouldBufferError(new Error("Circuit breaker is OPEN - failing fast"))).toBe(true);
  });

  it("returns true for retryable HttpError (503)", () => {
    expect(shouldBufferError(new HttpError("down", 503))).toBe(true);
  });

  it("returns true for retryable HttpError (429)", () => {
    expect(shouldBufferError(new HttpError("rate limit", 429))).toBe(true);
  });

  it("returns false for terminal HttpError (401)", () => {
    expect(shouldBufferError(new HttpError("unauthorized", 401))).toBe(false);
  });

  it("returns false for terminal HttpError (400)", () => {
    expect(shouldBufferError(new HttpError("bad request", 400))).toBe(false);
  });

  it("returns true for TypeError (network error)", () => {
    expect(shouldBufferError(new TypeError("fetch failed"))).toBe(true);
  });

  it("returns true for AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(shouldBufferError(err)).toBe(true);
  });

  it("returns false for generic Error", () => {
    expect(shouldBufferError(new Error("something"))).toBe(false);
  });
});
