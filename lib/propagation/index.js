/* global require, exports */
const honeycomb = require("./honeycomb");
const aws = require("./aws");
const w3c = require("./w3c");

exports.REQUEST_ID_HTTP_HEADER = "X-Request-ID";

// VERSION points to honeycomb.VERSION for backwards compatibility.

// Deprecated: Use honeycomb.VERSION
exports.VERSION = honeycomb.VERSION;

// unmarshalTraceContext wraps honeycomb.unmarshalTraceContext for backwards compatibility.

// Deprecated: Use honeycomb.unmarshalTraceContext
exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(traceHeader) {
  return honeycomb.unmarshalTraceContext(traceHeader);
}

// marshalTraceContext wraps honeycomb.marshalTraceContext for backwards compatibility.

// Deprecated: Use honeycomb.marshalTraceContext
exports.marshalTraceContext = marshalTraceContext;

function marshalTraceContext(context) {
  return honeycomb.marshalTraceContext(context);
}

exports.honeycomb = honeycomb;
exports.aws = aws;
exports.w3c = w3c;
