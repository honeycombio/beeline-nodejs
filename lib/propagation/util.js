/* eslint-env node */
const schema = require("../schema");

exports.currentSpanId = currentSpanId;

// fetch current span id from the trace context passed as an argument
function currentSpanId(context) {
  return context.stack[context.stack.length - 1].payload[schema.TRACE_SPAN_ID];
}

exports.transformExecutionToProp = transformExecutionToProp;

// transformExecutionToProp accepts the current execution context async hook
// and returns the standard trace propagation object
// containing the fields traceId, parentSpanId, dataset (optional), and customContext (optional)
// for use in propagation
function transformExecutionToProp(context = {}) {
  // standard propagation context fields and the path to its value
  const propagationFields = {
    traceId: context.id,
    parentSpanId: currentSpanId(context),
    dataset: context.dataset,
    customContext: context.traceContext,
  };

  // return a single object with all propagation fields mapped to the standard trace propagation object structure
  return Object.keys(propagationFields)
    .filter(key => propagationFields[key] !== undefined)
    .map(key => {
      return {
        [key]: propagationFields[key],
      };
    })
    .reduce((acc, obj) => Object.assign(acc, obj));
}
