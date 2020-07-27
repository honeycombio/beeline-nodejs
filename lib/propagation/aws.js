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

function unmarshalTraceContext(header = "") {
  let parentSpanId, customContext;
  const supportedFields = ["root", "self", "parent"];

  // parse out each field to key/value pairs and reduce to single object
  let { root, parent, self, ...rest } = header
    .split(";")
    .map(each => {
      let [key, value] = each.split("=");
      // return lowercase keys for parsable fields to allow case insensitivity
      if (supportedFields.includes(key.toLowerCase())) {
        return { [key.toLowerCase()]: value };
      }
      return { [key]: value };
    })
    .reduce((acc, obj) => Object.assign(acc, obj));

  // customContext remain undefined unless there are fields
  if (Object.keys(rest).length !== 0) {
    customContext = rest;
  }

  if (!root.length) {
    // if we didn't even get a 'Root=' clause, bail.
    return;
  }

  // if there's a "Parent=" field, use that as the parent span id
  if (parent) {
    parentSpanId = parent;
    // if there's a self and a parent, add self to the customContext
    if (self) {
      customContext = Object.assign({}, customContext, { Self: self });
    }
  }
  // if there is no "Parent=" but there's a "Self=",
  // use "Self=" as the parent span id
  else if (self) {
    parentSpanId = self;
  }
  // if no self or parent, use the "Root=" as the parent span id as well
  else {
    parentSpanId = root;
  }

  return {
    traceId: root,
    parentSpanId: parentSpanId,
    customContext,
  };
}
