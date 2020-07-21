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
  const { traceId, spanId } = parsed;

  return {
    traceId,
    parentSpanId: spanId,
  };
}

// marshalTraceContext takes a trace context object
// and returns a serialized honeycomb trace header
exports.marshalTraceContext = marshalTraceContext;

function marshalTraceContext(context) {
  return marshalTraceContextv1(context);
}

function marshalTraceContextv1(context) {
  const spanId = util.currentSpanId(context);

  // currently we do not propagate traceFlags
  // we will revisit as opentelemetry sampling evolves
  return `${VERSION}-${context.id}-${spanId}-01`;
}
