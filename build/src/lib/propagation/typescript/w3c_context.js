"use strict";
exports.__esModule = true;
exports.parseOtelTrace = void 0;
var core_1 = require("@opentelemetry/core");
function parseOtelTrace(header) {
  return core_1.parseTraceParent(header);
}
exports.parseOtelTrace = parseOtelTrace;
