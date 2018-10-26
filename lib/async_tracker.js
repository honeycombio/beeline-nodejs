/* eslint-env node */
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

  getTracked() {
    return this.tracked.get(async_hooks.executionAsyncId());
  }

  deleteTracked() {
    this.destroy(async_hooks.executionAsyncId());
  }

  runWithoutTracking(fn) {
    let tracked = this.getTracked();
    this.deleteTracked();

    try {
      return fn();
    } finally {
      if (tracked) {
        this.setTracked(tracked);
      }
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
      try {
        return fn.apply(this, args);
      } finally {
        tracker.deleteTracked();
      }
    };
  }

  // XXX(toshok) this feels wrong, but maybe not?
  callWithContext(fn, context) {
    let previousContext = this.getTracked();

    tracker.setTracked(context);
    try {
      return fn();
    } finally {
      tracker.setTracked(previousContext);
    }
  }

  // below is the portion of the async_hooks api we need.  they shouldn't be called directly
  // from user code.  They also aren't async safe - if any async code is added to them (like console.log)
  // we'll blow the stack.
  init(asyncId, type, triggerAsyncId, _resource) {
    if (this.tracked.has(triggerAsyncId)) {
      this.tracked.set(asyncId, this.tracked.get(triggerAsyncId));
    }
  }

  destroy(asyncId) {
    if (this.tracked.has(asyncId)) {
      this.tracked.delete(asyncId);
    }
  }
}

let tracker = new AsyncTracker();
let asyncHook = async_hooks.createHook(tracker);
asyncHook.enable();

module.exports = tracker;
