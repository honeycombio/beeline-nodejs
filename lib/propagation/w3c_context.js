/* global require, module */

// requiring the OTEL trace header key from the api
// as well as the parser
const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core");

function parseOtelTrace(header) {
  return parseTraceParent(header);
}

module.exports = { parseOtelTrace, TRACE_PARENT_HEADER };
