/* eslint-env node */
const schema = require("../schema");

exports.currentSpanId = currentSpanId;

// fetch current span id from active trace stack
function currentSpanId(context) {
  return context.stack[context.stack.length - 1].payload[schema.TRACE_SPAN_ID];
}
