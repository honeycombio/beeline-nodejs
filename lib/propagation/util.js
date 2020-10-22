/* eslint-env node */
const schema = require("../schema");

exports.currentSpanId = currentSpanId;

// fetch current span id from the trace context passed as an argument
function currentSpanId(context) {
  return context.stack[context.stack.length - 1].payload[schema.TRACE_SPAN_ID];
}

exports.getPropagationContext = getPropagationContext;

// getPropagationContext accepts the current execution context
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

exports.objToString = objToString;

// pass this util an object, return as string formatted to go into a trace header
// joinChar separates fields from each other, keyChar separates keys from values
function objToString(obj, joinChar = ",", keyChar = "=", prefix = "") {
  const keys = Object.keys(obj);
  if (keys.length == 0) {
    return "";
  }
  const fields = keys.map((key) => {
    return key + keyChar + obj[key];
  });
  return prefix + fields.join(joinChar);
}

exports.stringToObj = stringToObj;

// pass this util a string, return as JSON obj with keys and values
function stringToObj(string, joinChar = ",", keyChar = "=") {
  let obj;
  const fields = string.split(joinChar);

  fields.forEach((field) => {
    const [name, value] = field.split(keyChar);
    obj = Object.assign({}, obj, {
      [name]: value,
    });
  });

  return obj;
}
