/* eslint-env node */
const schema = require("../schema");

exports.currentSpanId = currentSpanId;

// fetch current span id from the trace context passed as an argument
function currentSpanId(context) {
  return context.stack[context.stack.length - 1].payload[schema.TRACE_SPAN_ID];
}

exports.currentSpan = currentSpan;

// fetch current span id from the trace context passed as an argument
function currentSpan(context) {
  return context.stack[context.stack.length - 1];
}

exports.rootSpan = rootSpan;

// fetch current span id from the trace context passed as an argument
function rootSpan(context) {
  return context.stack[0];
}
