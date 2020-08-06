/* global exports, require */
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
  let contextToSend = context.customContext || context.traceContext || {};

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
