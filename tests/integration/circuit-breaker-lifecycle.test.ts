import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerConfig,
} from "../../src/_core/resilience/circuit-breaker";

const config: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  successThreshold: 3,
  timeWindow: 60000,
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("circuit breaker full lifecycle", () => {
  it("CLOSED -> OPEN -> HALF_OPEN -> CLOSED", async () => {
    const cb = new CircuitBreaker(config);
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    for (let i = 0; i < 5; i++) {
      await cb.execute(() => Promise.reject(new Error(`fail-${i}`))).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);

    await expect(cb.execute(() => Promise.resolve("blocked"))).rejects.toThrow(
      "Circuit breaker is OPEN",
    );

    jest.advanceTimersByTime(30000);

    const probeResult = await cb.execute(() => Promise.resolve("probe-ok"));
    expect(probeResult).toBe("probe-ok");
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    await cb.execute(() => Promise.resolve("ok-2"));
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    await cb.execute(() => Promise.resolve("ok-3"));
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    const finalResult = await cb.execute(() => Promise.resolve("fully-recovered"));
    expect(finalResult).toBe("fully-recovered");
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it("HALF_OPEN reverts to OPEN on failure", async () => {
    const cb = new CircuitBreaker(config);

    for (let i = 0; i < 5; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(30000);

    await cb.execute(() => Promise.reject(new Error("fail-in-half-open"))).catch(() => {});
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });
});
