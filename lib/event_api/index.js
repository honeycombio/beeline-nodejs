/* eslint-env node */
const path = require("path"),
  schema = require("../schema"),
  propagation = require("../propagation"),
  tracker = require("../async_tracker"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`),
  LibhoneyEventAPI = require("./libhoney"),
  MockEventAPI = require("./mock");

let eventAPI;

module.exports = {
  configure(opts = {}) {
    if (eventAPI) {
      return;
    }

    let api = LibhoneyEventAPI;
    if (opts.api) {
      if (opts.api === "libhoney-event") {
        api = LibhoneyEventAPI;
      } else if (opts.api === "mock") {
        api = MockEventAPI;
      } else {
        throw new Error("Unrecognized .api.  valid options are 'libhoney-event' / 'mock'");
      }
    }
    debug(`using api: ${api == LibhoneyEventAPI ? "libhoney-event" : "mock"}`);
    eventAPI = new api(opts);
  },

  traceActive() {
    return !!tracker.getTracked();
  },
  clearTrace() {
    tracker.deleteTracked();
  },
  getTraceContext() {
    return tracker.getTracked();
  },

  TRACE_HTTP_HEADER: propagation.TRACE_HTTP_HEADER,
  marshalTraceContext: propagation.marshalTraceContext,
  unmarshalTraceContext: propagation.unmarshalTraceContext,

  startTrace(metadataContext, withTraceId, withParentSpanId) {
    return eventAPI.startTrace(metadataContext, withTraceId, withParentSpanId);
  },
  finishTrace(trace) {
    return eventAPI.finishTrace(trace);
  },
  withTrace(metadataContext, fn, withTraceId, withParentSpanId) {
    const trace = eventAPI.startTrace(metadataContext, withTraceId, withParentSpanId);
    try {
      return fn();
    } finally {
      eventAPI.finishTrace(trace);
    }
  },

  startSpan(metadataContext) {
    return eventAPI.startSpan(metadataContext);
  },
  finishSpan(span, rollupKey) {
    return eventAPI.finishSpan(span, rollupKey);
  },
  withSpan(metadataContext, fn, rollupKey) {
    const span = eventAPI.startSpan(metadataContext);
    try {
      return fn();
    } finally {
      eventAPI.finishSpan(span, rollupKey);
    }
  },

  startTimer(name) {
    return {
      name,
      startTimeHR: process.hrtime(),
    };
  },
  finishTimer(timer) {
    const { name, startTimeHR } = timer;
    const duration = process.hrtime(startTimeHR);
    const durationMs = (duration[0] * 1e9 + duration[1]) / 1e6;

    this.addContext({
      [`${name}_ms`]: durationMs,
    });
  },
  withTimer(name, fn) {
    const timer = eventAPI.startTimer(name);
    try {
      return fn();
    } finally {
      eventAPI.finishTimer(timer);
    }
  },

  addContext(map) {
    return eventAPI.addContext(map);
  },
  removeContext(key) {
    return eventAPI.removeContext(key);
  },
  customContext: {
    add(key, val) {
      eventAPI.addContext({ [schema.customContext(key)]: val });
    },
    remove(key) {
      eventAPI.removeContext(schema.customContext(key));
    },
  },

  // a couple of useful functions for either forcing a function to run within a trace, or
  // force it to run outside of it.  Mostly useful for writing instrumentation.
  bindFunctionToTrace(fn) {
    return tracker.bindFunction(fn);
  },
  runWithoutTrace(fn) {
    return tracker.runWithoutTracking(fn);
  },

  // these are exposed just for tests or instrumentation.  don't use them from outside.
  _askForIssue(msg, logger = debug) {
    return eventAPI.askForIssue(msg, logger);
  },

  _apiForTesting() {
    return eventAPI;
  },
  _resetForTesting() {
    eventAPI = null;
  },
};
