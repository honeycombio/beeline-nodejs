/* global require, exports */
const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core");

// requiring the OTEL trace header key from the api
// as well as the parser
exports.TRACE_HTTP_HEADER = TRACE_PARENT_HEADER;

exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(header) {
  console.log(parseTraceParent(header));
  return parseTraceParent(header);
}

module.exports = {
  unmarshalTraceContext,
  TRACE_HTTP_HEADER,
};