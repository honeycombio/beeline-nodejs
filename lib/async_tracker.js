const async_hooks = require("async_hooks");

class AsyncTracker {
  constructor() {
    this.tracked = new Map();

    this.init = this.init.bind(this);
    this.destroy = this.destroy.bind(this);
  }

  setTracked(value) {
    this.tracked.set(async_hooks.executionAsyncId(), value);
  }

  getTracked(subPayloadKey) {
    let aggregatePayload = this.tracked.get(async_hooks.executionAsyncId());
    if (!aggregatePayload) {
      return aggregatePayload;
    }
    if (!subPayloadKey) {
      return aggregatePayload;
    }
    if (!aggregatePayload[subPayloadKey]) {
      aggregatePayload[subPayloadKey] = {};
    }
    return aggregatePayload[subPayloadKey];
  }

  deleteTracked() {
    this.destroy(async_hooks.executionAsyncId());
  }

  runWithoutTracking(fn) {
    let tracked = this.getTracked();
    this.deleteTracked();

    try {
      fn();
    } finally {
      if (tracked) {
        this.setTracked(tracked);
      }
    }
  }

  init(asyncId, type, triggerAsyncId, resource) {
    if (this.tracked.has(triggerAsyncId)) {
      this.tracked.set(asyncId, this.tracked.get(triggerAsyncId));
    }
  }

  destroy(asyncId) {
    if (this.tracked.has(asyncId)) {
      this.tracked.delete(asyncId);
    }
  }

  bindFunction(fn) {
    if (typeof fn !== "function") {
      return fn;
    }
    // binds fn to execute using the same tracked context as executionAsyncId's
    let tracked = this.getTracked();
    let tracker = this;
    return function(...args) {
      tracker.setTracked(tracked);
      let rv = fn.apply(this, args);
      tracker.deleteTracked();
      return rv;
    };
  }
}

let tracker = new AsyncTracker();
let asyncHook = async_hooks.createHook(tracker);
asyncHook.enable();

module.exports = tracker;
