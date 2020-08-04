/* global exports, require */
const util = require("./util");

const TRACE_HTTP_HEADER = "X-Amzn-Trace-Id";
exports.TRACE_HTTP_HEADER = TRACE_HTTP_HEADER;

function definedAndNotEmpty(value) {
  if (!value || value.length === 0) {
    return false;
  }

  return true;
}

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

  return `Root=${traceId};Parent=${spanId}${contextToSend}`;
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

  if (!definedAndNotEmpty(root)) {
    // if we didn't even get a 'Root=' clause, bail.
    return;
  }

  // if there's a "Self=" field, use that as the parent span id
  if (definedAndNotEmpty(self)) {
    parentSpanId = self;
  }
  // if there is no "Self=" but there's a "Parent=",
  // use "Parent=" as the parent span id
  else if (definedAndNotEmpty(parent)) {
    parentSpanId = parent;
  }
  // if no self or parent, use the "Root=" as the parent span id as well
  else {
    parentSpanId = root;
  }

  return {
    traceId: root,
    parentSpanId,
    customContext,
  };
}
