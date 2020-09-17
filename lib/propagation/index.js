/* eslint-env node */
const honeycomb = require("./honeycomb"),
  aws = require("./aws"),
  w3c = require("./w3c"),
  util = require("./util");

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
exports.util = util;

// exported to run on require and module load with other configurations
exports.configure = util.configure;

exports.parseFromRequest = util.parseFromRequest;
exports.headersFromContext = util.headersFromContext;
