/* global exports, require */
const util = require("./util");

const TRACE_HTTP_HEADER = "X-Amzn-Trace-Id";
exports.TRACE_HTTP_HEADER = TRACE_HTTP_HEADER;

// marshalTraceContext takes a trace context object
// and returns a serialized honeycomb trace header
exports.marshalTraceContext = marshalTraceContext;

function marshalTraceContext(context) {
  return marshalTraceContextv1(context);
}

function marshalTraceContextv1(context) {
  let traceId = context.id;
  let spanId = util.currentSpanId(context);
  let contextToSend = context.traceContext || {};

  if (context.traceContext) {
    const elements = Object.keys(context.traceContext).map(key => {
      return `${key}=${context.traceContext[key]}`;
    });
    contextToSend = ";" + elements.join(";");
  }

  return `Root=1-${traceId};Parent=${spanId}${contextToSend}`;
}

// unmarshalTraceContext takes a string trace header and returns a context
exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(header) {
  let traceId, parentSpanId, customContext;

  const split = header.split(";");
  for (const s of split) {
    const [name, value] = s.split("=");
    if (name === "Root") {
      traceId = value;
    } else if (name === "Parent") {
      parentSpanId = value;
    } else {
      customContext = Object.assign({}, customContext, {
        [name]: value,
      });
    }
  }

  if (!traceId) {
    // if we didn't even get a 'Root=' clause, bail.
    return;
  }

  if (!parentSpanId) {
    parentSpanId = traceId;
  }

  return {
    traceId,
    parentSpanId,
    customContext,
  };
}

exports.httpTraceParserHook = httpTraceParserHook;

// parserHook functions do not require users to pass an input
// the instrumentation will provide the request object
function httpTraceParserHook(req = {}) {
  const header = req.headers && req.headers["x-amzn-trace-id"];

  return unmarshalTraceContext(header);
}

exports.httpTracePropagationHook = httpTracePropagationHook;

function httpTracePropagationHook(context = {}) {
  return { [TRACE_HTTP_HEADER]: marshalTraceContext(context) };
}
