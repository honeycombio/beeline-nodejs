/* eslint-env node */
const schema = require("../schema");

exports.currentSpanId = currentSpanId;

// fetch current span id from the trace context passed as an argument
function currentSpanId(context) {
  return context.stack[context.stack.length - 1].payload[schema.TRACE_SPAN_ID];
}

exports.getPropagationContext = getPropagationContext;

// getPropagationContext accepts the current execution context async hook
// and returns the standard trace propagation object
// containing the fields traceId, parentSpanId, dataset (optional), and customContext (optional)
// for use in propagation
function getPropagationContext(context = {}) {
  // standard propagation context fields and the path to its value
  return {
    traceId: context.id,
    parentSpanId: currentSpanId(context),
    dataset: context.dataset,
    customContext: context.traceContext,
  };
}
