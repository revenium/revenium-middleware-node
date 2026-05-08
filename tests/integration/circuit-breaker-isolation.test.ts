import {
  CircuitState,
  getMeteringCircuitBreaker,
  getEnforcementCircuitBreaker,
  executeWithMeteringCircuitBreaker,
  executeWithEnforcementCircuitBreaker,
  resetMeteringCircuitBreaker,
  resetEnforcementCircuitBreaker,
} from "../../src/_core/resilience/circuit-breaker";

beforeEach(() => {
  resetMeteringCircuitBreaker();
  resetEnforcementCircuitBreaker();
});

describe("metering vs enforcement circuit breaker isolation", () => {
  it("metering breaker OPEN does not fail-open enforcement calls", async () => {
    for (let i = 0; i < 12; i++) {
      await executeWithMeteringCircuitBreaker(() =>
        Promise.reject(new Error("metering 503")),
      ).catch(() => {});
    }
    expect(getMeteringCircuitBreaker().getState()).toBe(CircuitState.OPEN);

    await expect(
      executeWithMeteringCircuitBreaker(() => Promise.resolve("late metering call")),
    ).rejects.toThrow("Circuit breaker is OPEN");

    const enforcementResult = await executeWithEnforcementCircuitBreaker(() =>
      Promise.resolve("enforcement-rules-fetched"),
    );
    expect(enforcementResult).toBe("enforcement-rules-fetched");
    expect(getEnforcementCircuitBreaker().getState()).toBe(CircuitState.CLOSED);
  });

  it("enforcement breaker OPEN does not block metering calls", async () => {
    for (let i = 0; i < 12; i++) {
      await executeWithEnforcementCircuitBreaker(() =>
        Promise.reject(new Error("enforcement 503")),
      ).catch(() => {});
    }
    expect(getEnforcementCircuitBreaker().getState()).toBe(CircuitState.OPEN);

    await expect(
      executeWithEnforcementCircuitBreaker(() => Promise.resolve("late enforcement call")),
    ).rejects.toThrow("Circuit breaker is OPEN");

    const meteringResult = await executeWithMeteringCircuitBreaker(() =>
      Promise.resolve("ai-completion-tracked"),
    );
    expect(meteringResult).toBe("ai-completion-tracked");
    expect(getMeteringCircuitBreaker().getState()).toBe(CircuitState.CLOSED);
  });

  it("interleaved failures on both paths trip each breaker independently", async () => {
    for (let i = 0; i < 12; i++) {
      await executeWithMeteringCircuitBreaker(() => Promise.reject(new Error("m"))).catch(() => {});
      await executeWithEnforcementCircuitBreaker(() => Promise.resolve("ok")).catch(() => {});
    }
    expect(getMeteringCircuitBreaker().getState()).toBe(CircuitState.OPEN);
    expect(getEnforcementCircuitBreaker().getState()).toBe(CircuitState.CLOSED);
  });
});
