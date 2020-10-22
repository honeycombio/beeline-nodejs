/* eslint-env node */
const util = require("./util");

const TRACE_HTTP_HEADER = "X-Amzn-Trace-Id";
exports.TRACE_HTTP_HEADER = TRACE_HTTP_HEADER;

// marshalTraceContext takes a trace context object
// and returns a serialized honeycomb trace header
exports.marshalTraceContext = marshalTraceContextv1;

function marshalTraceContextv1(context) {
  // expect propagation context structure
  // fall back to execution context structure for backwards compatibility
  let traceId = context.traceId || context.id;
  let spanId = context.parentSpanId || util.currentSpanId(context);
  let traceFields = context.customContext || context.traceContext || {};

  if (!traceId || !spanId) {
    return null;
  }

  let contextToSend = "";

  if (Object.keys(traceFields).length > 0) {
    contextToSend = util.objToString(traceFields, ";", "=", ";");
  }

  return `Root=${traceId};Parent=${spanId}${contextToSend}`;
}

// unmarshalTraceContext takes a string trace header and returns a context
exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(header) {
  let traceId, parentSpanId, customContext;
  let self;

  const split = header.split(";");
  for (const s of split) {
    const [name, value] = s.split("=");
    switch (name.toLowerCase()) {
      case "root":
        traceId = value;
        break;
      case "parent":
        parentSpanId = value;
        break;
      case "self":
        self = value;
        break;
      default:
        // propagate trace headers without case changes
        customContext = Object.assign({}, customContext, {
          [name]: value,
        });
    }
  }

  if (!traceId) {
    // if we didn't even get a 'Root=' clause, bail.
    return;
  }

  // use self if parent was not present
  if (!parentSpanId && self) {
    parentSpanId = self;
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

function httpTraceParserHook(httpReq) {
  const header = httpReq.headers["x-amzn-trace-id"];
  if (!header) {
    return null;
  }
  return unmarshalTraceContext(header);
}

exports.httpTracePropagationHook = httpTracePropagationHook;

function httpTracePropagationHook(context) {
  const headerValue = marshalTraceContextv1(context);
  if (!headerValue) {
    return null;
  }
  return { [TRACE_HTTP_HEADER]: headerValue };
}
