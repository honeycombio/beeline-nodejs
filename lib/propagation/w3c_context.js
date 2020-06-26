/* global require, module */

const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core")

function parseOtelTrace(header) {
    return parseTraceParent(header);
}

module.exports = { parseOtelTrace, TRACE_PARENT_HEADER };