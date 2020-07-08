/* global require, exports */
const honeycomb = require("./honeycomb");
exports.aws = require("./aws");

exports.REQUEST_ID_HTTP_HEADER = "X-Request-ID";

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
