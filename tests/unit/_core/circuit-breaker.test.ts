import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerConfig,
  FailureStrategy,
  resetCircuitBreaker,
} from "../../../src/_core/resilience/circuit-breaker";

const testConfig: CircuitBreakerConfig = {
  failureThreshold: 3,
  recoveryTimeout: 5000,
  successThreshold: 2,
  timeWindow: 60000,
};

beforeEach(() => {
  jest.useFakeTimers();
  resetCircuitBreaker();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("CircuitBreaker", () => {
  it("starts in CLOSED state", () => {
    const cb = new CircuitBreaker(testConfig);
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it("stays CLOSED on successful executions", async () => {
    const cb = new CircuitBreaker(testConfig);
    await cb.execute(() => Promise.resolve("ok"));
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it("transitions to OPEN after threshold failures", async () => {
    const cb = new CircuitBreaker(testConfig);
    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it("rejects immediately when OPEN", async () => {
    const cb = new CircuitBreaker(testConfig);
    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    await expect(cb.execute(() => Promise.resolve("ok"))).rejects.toThrow(
      "Circuit breaker is OPEN",
    );
  });

  it("transitions to HALF_OPEN after recovery timeout", async () => {
    const cb = new CircuitBreaker(testConfig);
    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);

    jest.advanceTimersByTime(testConfig.recoveryTimeout);

    await cb.execute(() => Promise.resolve("ok"));
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
  });

  it("transitions HALF_OPEN -> CLOSED after success threshold", async () => {
    const cb = new CircuitBreaker(testConfig);
    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    jest.advanceTimersByTime(testConfig.recoveryTimeout);

    for (let i = 0; i < testConfig.successThreshold; i++) {
      await cb.execute(() => Promise.resolve("ok"));
    }
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it("transitions HALF_OPEN -> OPEN on failure", async () => {
    const cb = new CircuitBreaker(testConfig);
    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }

    jest.advanceTimersByTime(testConfig.recoveryTimeout);

    await cb.execute(() => Promise.reject(new Error("fail again"))).catch(() => {});
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it("canExecute reflects current state", async () => {
    const cb = new CircuitBreaker(testConfig);
    expect(cb.canExecute()).toBe(true);

    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(cb.canExecute()).toBe(false);

    jest.advanceTimersByTime(testConfig.recoveryTimeout);
    expect(cb.canExecute()).toBe(true);
  });

  it("getStats returns accurate counters", async () => {
    const cb = new CircuitBreaker(testConfig);
    await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});

    const stats = cb.getStats();
    expect(stats.state).toBe(CircuitState.CLOSED);
    expect(stats.failureCount).toBe(1);
    expect(stats.recentFailures).toBe(1);
  });

  it("reset brings back to initial state", async () => {
    const cb = new CircuitBreaker(testConfig);
    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);

    cb.reset();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(cb.getStats().failureCount).toBe(0);
  });

  it("respects custom FailureStrategy", async () => {
    const strategy: FailureStrategy = {
      isRetryableError: (err) => {
        return err instanceof Error && err.message.includes("retryable");
      },
      isProviderThrottling: () => false,
    };
    const cb = new CircuitBreaker(testConfig, strategy);

    for (let i = 0; i < testConfig.failureThreshold + 2; i++) {
      await cb.execute(() => Promise.reject(new Error("permanent-failure"))).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    for (let i = 0; i < testConfig.failureThreshold; i++) {
      await cb.execute(() => Promise.reject(new Error("retryable"))).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });
});
