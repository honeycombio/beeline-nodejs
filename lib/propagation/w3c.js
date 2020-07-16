/* global require, exports */
const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core"),
  util = require("./util");
// requiring the OTEL trace header key from the api
// as well as the parser
exports.TRACE_HTTP_HEADER = TRACE_PARENT_HEADER;

const VERSION = "00";
exports.VERSION = VERSION;

exports.unmarshalTraceContext = unmarshalTraceContext;

// unmarshalTraceContext takes an incoming header
// and returns a context in a format the beeline can use

// OTEL context structure         Beeline context
// traceId                   -->  traceId
// spanId                    -->  parentSpanId
// traceFlags                -->  context.traceFlags (nested field in context: {})
// isRemote (optional)       -->  context.isRemote (nested field in context: {})
// traceState (optional)     -->  context.traceState (nested field in context: {})

function unmarshalTraceContext(header) {
  const regex = new RegExp(`^${VERSION}`, "g");

  // check for supported version
  if (!header.match(regex)) {
    // bail if not supported
    return;
  }

  return unmarshalTraceContextv1(header);
}

// v1 here refers to honeycomb, the context structure
function unmarshalTraceContextv1(header) {
  // pull out required fields, ... for all optional
  // using spread operator defaults all values to undefined for invalid header values
  const parsed = parseTraceParent(header);
  if (!parsed) {
    return;
  }
  const { traceId, spanId, traceFlags, ...optionalFields } = parsed;

  // traceFlags goes into our context field as a nested value
  const customContext = Object.assign({ traceFlags }, optionalFields);

  return {
    traceId,
    parentSpanId: spanId,
    customContext,
  };
}

exports.marshalTraceContext = marshalTraceContext;

function marshalTraceContext(context) {
  return marshalTraceContextv1(context);
}

function marshalTraceContextv1(context) {
  let spanId = util.currentSpanId(context);

  // find traceFlags setting or fallback to 1 (sampled)
  let traceFlags = context.traceContext.traceFlags || 1;

  // if traceFlags is a number and not a 1, pass it along
  // this will cover the "00" and future upgrades
  // undefined will fall back to 1 above
  if (
    context.traceContext.traceFlags !== 1 &&
    typeof context.traceContext.traceFlags === "number"
  ) {
    traceFlags = context.traceContext.traceFlags;
  }

  // string literal pulled from opentelemetry-js, variables have been swapped for honeycomb use
  return `${VERSION}-${context.id}-${spanId}-0${Number(traceFlags).toString(16)}`;
}
