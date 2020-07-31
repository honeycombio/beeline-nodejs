/* global require, exports */
const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core"),
  util = require("./util");
// requiring the OTEL trace header key from the api
// as well as the parser
const TRACE_HTTP_HEADER = TRACE_PARENT_HEADER;
exports.TRACE_HTTP_HEADER = TRACE_HTTP_HEADER;

const TRACE_STATE_HEADER = "tracestate";
exports.TRACE_STATE_HEADER = TRACE_STATE_HEADER;

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

  // if a string argument is recieved, assume that's
  // the value of traceparent and move on to parsing
  if (typeof header === "string") {
    // check for supported version
    if (!header.match(regex)) {
      // bail if not supported
      return;
    }
    return unmarshalTraceContextv1(header);
  } else {
    // otherwise, expect a propagation context and object containing both traceparent and tracestate
    const { traceparent } = header;

    if (!traceparent || !traceparent.match(regex)) {
      return;
    }
    return unmarshalTraceContextFromHeadersv1(header);
  }
}

// v1 here refers to honeycomb, the context structure
function unmarshalTraceContextv1(header) {
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

exports.unmarshalTraceContextFromHeaders = unmarshalTraceContextFromHeaders;

function unmarshalTraceContextFromHeaders(context = {}, headers = {}) {
  const regex = new RegExp(`^${VERSION}`, "g");
  const { traceparent } = headers[TRACE_HTTP_HEADER];

  // check for supported version
  if (!traceparent && !traceparent.match(regex)) {
    // bail if not supported or if traceparent is undefined
    return;
  }

  return unmarshalTraceContextFromHeadersv1(context, headers);
}

// v1 here refers to honeycomb, the context structure
function unmarshalTraceContextFromHeadersv1(headers = {}) {
  const { traceparent, tracestate } = headers;
  const parsedTraceparent = parseTraceParent(traceparent);

  if (!parsedTraceparent || !parseTraceParent.traceId) {
    return;
  }

  const { traceId, spanId } = parsedTraceparent;

  let propagationContext = {
    traceId,
    parentSpanId: spanId,
  };

  // add tracestate as an opaque string value in customContext
  if (tracestate && tracestate.length !== 0) {
    propagationContext.customContext.tracestate = tracestate;
  }

  return propagationContext;
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

exports.httpTraceParserHook = httpTraceParserHook;

// parserHook functions do not require users to pass an input
// the instrumentation will provide the request object
function httpTraceParserHook(req = {}) {
  const { traceparent, tracestate } = req.headers;

  return unmarshalTraceContext({
    traceparent,
    tracestate,
  });
}

exports.httpTracePropagationHook = httpTracePropagationHook;

function httpTracePropagationHook(context = {}) {
  // tracestate default to undefined so it will only be included when needed
  let headers = {
    [TRACE_HTTP_HEADER]: marshalTraceContext(context),
  };

  // add tracestate if there are fields in traceContext
  const { traceContext } = context;

  if (traceContext.tracestate) {
    headers.tracestate = traceContext.tracestate;
  }

  return headers;
}
