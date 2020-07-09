/* global require, exports */
const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core");

// requiring the OTEL trace header key from the api
// as well as the parser
exports.TRACE_HTTP_HEADER = TRACE_PARENT_HEADER;

exports.unmarshalTraceContext = unmarshalTraceContext;

function addToContext(base, headers) {
  Object.assign(base, headers);
}

// unmarshalTraceContext takes an incoming header
// and returns a context in a format the beeline can use

// OTEL context structure         Beeline context
// traceId                   -->  traceId
// spanId                    -->  parentSpanId
// traceFlags                -->  context.traceFlags (nested field in context: {})
// isRemote (optional)       -->  context.isRemote (nested field in context: {})
// traceState (optional)     -->  context.traceState (nested field in context: {})

function unmarshalTraceContext(header) {
  // pull out required fields, ... for all optional
  const { traceId, spanId, traceFlags, ...optionalFields } = parseTraceParent(header);

  // traceFlags goes into our context field as a nested value
  let spanContext = Object.assign(
    {},
    {
      traceId,
      parentSpanId: spanId,
      context: {
        traceFlags,
      },
    }
  );

  // if optionalFields is truthy
  // and there's something in there
  if (optionalFields && Object.keys(optionalFields).length !== 0) {
    // add the optional fields to the context field in the target object (spanContext)
    addToContext(spanContext.context, optionalFields);
  }

  return spanContext;
}
