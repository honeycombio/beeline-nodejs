/* global require, exports */
const honeycomb = require("./honeycomb");
exports.aws = require("./aws");

exports.REQUEST_ID_HTTP_HEADER = "X-Request-ID";

// unmarshalTraceContext takes a trace header (string)
// and returns a span context object
exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(traceHeader) {
  return honeycomb.unmarshalHoneycombTraceContext(traceHeader);
}

// marshalTraceContext takes a span context object
// and returns a trace header (string)
exports.marshalTraceContext = marshalTraceContext;

function marshalTraceContext(context) {
  return honeycomb.marshalHoneycombTraceContext(context);
}

exports.honeycomb = honeycomb;
