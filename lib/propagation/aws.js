/* global exports, require */
const util = require("./util");

const TRACE_HTTP_HEADER = "X-Amzn-Trace-Id";
exports.TRACE_HTTP_HEADER = TRACE_HTTP_HEADER;

// marshalTraceContext takes a trace context object
// and returns a serialized honeycomb trace header
exports.marshalTraceContext = marshalTraceContextv1;

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

  return `Root=1-${traceId};Self=${spanId}${contextToSend}`;
}

// unmarshalTraceContext takes a string trace header and returns a context
exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(header) {
  let parentSpanId;

  let { root, parent, self, ...rest } = header
    .split(";")
    .map(each => {
      // split each field at the "=" and reduce to single object
      let [key, value] = each.split("=");
      return { [key.toLowerCase()]: value };
    })
    .reduce((acc, obj) => Object.assign(acc, obj));

  if (!root) {
    // if we didn't even get a 'Root=' clause, bail.
    return;
  }

  // if there's a "Self=" field, use that as the parent span
  if (self) {
    parentSpanId = self;
    // if there's a self and a parent, add parent to the customContext
    if (parent) {
      rest = Object.assign(rest, { parent });
    }
  }
  // if there is no "Self=" but there's a "Parent=",
  // use "Parent=" as the parent span
  else if (parent) {
    parentSpanId = parent;
  }
  // otherwise, use the "Root=" as the parent span id
  else {
    parentSpanId = root;
  }

  return {
    traceId: root,
    parentSpanId: parentSpanId,
    customContext: rest,
  };
}
