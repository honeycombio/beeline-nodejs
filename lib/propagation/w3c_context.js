"use strict";
exports.__esModule = true;
exports.TRACE_PARENT_HEADER = exports.parseOtelTrace = void 0;
var core_1 = require("@opentelemetry/core");
exports.TRACE_PARENT_HEADER = core_1.TRACE_PARENT_HEADER;
function parseOtelTrace(header) {
    return core_1.parseTraceParent(header);
}
exports.parseOtelTrace = parseOtelTrace;
