/* eslint-env node */
const process = require("process"),
  schema = require("../schema"),
  propagation = require("../propagation"),
  tracker = require("../async_tracker"),
  pkg = require("../../package.json"),
  debug = require("debug")(`${pkg.name}:event`),
  LibhoneyImpl = require("./libhoney"),
  MockImpl = require("./mock"),
  utils = require("../util");

const { honeycomb, aws, w3c, util } = propagation;

let apiImpl;

function mapFieldsToApp(map) {
  let mapped = {};
  for (const k of Object.getOwnPropertyNames(map)) {
    mapped[schema.customContext(k)] = map[k];
  }
  return mapped;
}

module.exports = {
  configure(opts = {}) {
    if (apiImpl) {
      return;
    }

    let impl = LibhoneyImpl;
    if (opts.impl) {
      if (opts.impl === "libhoney-event") {
        impl = LibhoneyImpl;
      } else if (opts.impl === "mock") {
        impl = MockImpl;
      } else {
        throw new Error("Unrecognized .impl.  valid options are 'libhoney-event' / 'mock'");
      }
    }
    debug(`using impl: ${impl == LibhoneyImpl ? "libhoney-event" : "mock"}`);
    apiImpl = new impl(opts);

    // tell honeycomb propagator whether we should propagate dataset
    honeycomb.setPropagateDataset(utils.isClassic(opts.writeKey));
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

  getPropagationContext() {
    return util.getPropagationContext(tracker.getTracked());
  },

  REQUEST_ID_HTTP_HEADER: propagation.REQUEST_ID_HTTP_HEADER,

  honeycomb: {
    TRACE_HTTP_HEADER: honeycomb.TRACE_HTTP_HEADER,
    unmarshalTraceContext: honeycomb.unmarshalTraceContext,
    marshalTraceContext: honeycomb.marshalTraceContext,
    httpTraceParserHook: honeycomb.httpTraceParserHook,
    httpTracePropagationHook: honeycomb.httpTracePropagationHook,
  },

  aws: {
    TRACE_HTTP_HEADER: aws.TRACE_HTTP_HEADER,
    unmarshalTraceContext: aws.unmarshalTraceContext,
    marshalTraceContext: aws.marshalTraceContext,
    httpTraceParserHook: aws.httpTraceParserHook,
    httpTracePropagationHook: aws.httpTracePropagationHook,
  },

  w3c: {
    TRACE_HTTP_HEADER: w3c.TRACE_HTTP_HEADER,
    unmarshalTraceContext: w3c.unmarshalTraceContext,
    marshalTraceContext: w3c.marshalTraceContext,
    httpTraceParserHook: w3c.httpTraceParserHook,
    httpTracePropagationHook: w3c.httpTracePropagationHook,
  },

  startTrace(fields, withTraceId, withParentSpanId, withDataset, propagatedContext = {}) {
    return apiImpl.startTrace(
      fields,
      withTraceId,
      withParentSpanId,
      withDataset,
      propagatedContext
    );
  },

  finishTrace(trace) {
    return apiImpl.finishTrace(trace);
  },
  withTrace(
    metadataContext,
    fn,
    withTraceId,
    withParentSpanId,
    withDataset,
    propagatedContext = {}
  ) {
    const trace = apiImpl.startTrace(
      metadataContext,
      withTraceId,
      withParentSpanId,
      withDataset,
      propagatedContext
    );
    try {
      return fn();
    } finally {
      apiImpl.finishTrace(trace);
    }
  },

  startSpan(metadataContext) {
    return apiImpl.startSpan(metadataContext);
  },
  finishSpan(span, rollupKey) {
    return apiImpl.finishSpan(span, rollupKey);
  },
  withSpan(metadataContext, fn, rollupKey) {
    const span = apiImpl.startSpan(metadataContext);
    try {
      return fn();
    } finally {
      apiImpl.finishSpan(span, rollupKey);
    }
  },

  startAsyncSpan(metadataContext, spanFn) {
    return apiImpl.startAsyncSpan(metadataContext, spanFn);
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

    apiImpl.addContext({
      [`${name}_ms`]: durationMs,
    });
  },
  withTimer(name, fn) {
    const timer = apiImpl.startTimer(name);
    try {
      return fn();
    } finally {
      apiImpl.finishTimer(timer);
    }
  },

  // next major bump should change this to prefix keys with `app.`
  addContext(map) {
    return apiImpl.addContext(map);
  },

  incrementTraceRollup(key, durationMs, count) {
    return apiImpl.incrementTraceRollup(key, durationMs, count);
  },

  addTraceContext(map) {
    return apiImpl.addTraceContext(mapFieldsToApp(map));
  },

  // a couple of useful functions for either forcing a function to run within a trace, or
  // force it to run outside of it.  Mostly useful for writing instrumentation.
  bindFunctionToTrace(fn) {
    return tracker.bindFunction(fn);
  },
  runWithoutTrace(fn) {
    return tracker.runWithoutTracking(fn);
  },

  flush() {
    return apiImpl.flush();
  },

  // these are exposed just for tests or instrumentation.  don't use them from
  // application code.
  _askForIssue(msg, logger = debug) {
    return apiImpl.askForIssue(msg, logger);
  },

  _apiForTesting() {
    return apiImpl;
  },
  _resetForTesting() {
    apiImpl = null;
  },
};
