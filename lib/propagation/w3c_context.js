"use strict";
exports.__esModule = true;
exports.parseTraceParent = void 0;
var core_1 = require("@opentelemetry/core");
exports.parseTraceParent = core_1.parseTraceParent;
function initializeSpanContext(spanContext) {}
function parseOtelTrace(header) {
  var traceparent = header.traceparent;
  return core_1.parseTraceParent(traceparent);
}
