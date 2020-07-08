/* global require, exports */
const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core");

// requiring the OTEL trace header key from the api
// as well as the parser
exports.TRACE_PARENT_HEADER = TRACE_PARENT_HEADER;

exports.parseOtelTrace = parseOtelTrace;

function parseOtelTrace(header) {
  return parseTraceParent(header);
}
