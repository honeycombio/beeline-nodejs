/* eslint-env node */
// requiring the OTEL trace header key from the api
// as well as the parser
const { TRACE_PARENT_HEADER, parseTraceParent } = require("@opentelemetry/core"),
  path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:propagation:w3c`),
  util = require("./util");

exports.TRACE_HTTP_HEADER = TRACE_PARENT_HEADER;
const TRACE_HTTP_HEADER = TRACE_PARENT_HEADER;

const TRACE_STATE_HEADER = "tracestate";
exports.TRACE_STATE_HEADER = TRACE_STATE_HEADER;

const TRACE_ID_REGEX = /^[A-Fa-f0-9]{32}$/g;
const SPAN_ID_REGEX = /^[A-Fa-f0-9]{16}$/g;

exports.unmarshalTraceContext = unmarshalTraceContextv1;

// unmarshalTraceContext takes an incoming header
// and returns a context in a format the beeline can use

// OTEL context structure         Beeline context
// traceId                   -->  traceId
// spanId                    -->  parentSpanId
// traceFlags                -->  context.traceFlags (nested field in context: {})
// isRemote (optional)       -->  context.isRemote (nested field in context: {})
// traceState (optional)     -->  context.traceState (nested field in context: {})

// v1 here refers to honeycomb, the context structure
function unmarshalTraceContextv1(traceparent, tracestate) {
  let parsedTraceState;
  try {
    const parsedTraceParent = parseTraceParent(traceparent);
    if (!parsedTraceParent) {
      return;
    }
    const { traceId, spanId } = parsedTraceParent;

    if (tracestate) {
      parsedTraceState = util.stringToObj(tracestate);
    }

    return {
      traceId,
      parentSpanId: spanId,
      customContext: parsedTraceState,
    };
  } catch (error) {
    debug(
      `error: ${error},
       unable to parse trace header: expected string value of "traceparent", received ${traceparent}`
    );
  }
}

// marshalTraceContext takes a trace context object
// and returns a serialized honeycomb trace header
exports.marshalTraceContext = marshalTraceContext;

function marshalTraceContext(context) {
  return marshalTraceContextv1(context);
}

function marshalTraceContextv1(context) {
  // expect propagation context structure
  // fall back to execution context structure for backwards compatibility
  let traceId = context.traceId || context.id;
  let parentSpanId = context.parentSpanId || util.currentSpanId(context);

  // do not propagate non-standard ids
  if (!traceId.match(TRACE_ID_REGEX)) {
    debug(
      "unable to propagate w3c trace header: trace id must be a 32-character hex encoded string"
    );
    return "";
  }

  if (!parentSpanId.match(SPAN_ID_REGEX)) {
    debug("unable to propagate w3c span header: span id must be a 16-character hex encoded string");
    return "";
  }

  // currently we do not propagate traceFlags
  // we will revisit as opentelemetry sampling evolves
  return `00-${traceId}-${parentSpanId}-01`;
}

exports.httpTraceParserHook = httpTraceParserHook;

function httpTraceParserHook(httpReq) {
  const { traceparent, tracestate } = httpReq.headers;

  if (!traceparent) {
    debug("'traceparent' request header not detected");
    return null;
  }

  return exports.unmarshalTraceContext(traceparent, tracestate);
}

exports.httpTracePropagationHook = httpTracePropagationHook;

function httpTracePropagationHook(context = {}) {
  // tracestate default to undefined so it will only be included when needed
  let headers = {
    [TRACE_HTTP_HEADER]: marshalTraceContext(context),
  };

  // add tracestate if there are fields in traceContext
  const { customContext } = context;

  if (customContext && Object.keys(customContext).length > 0) {
    headers.tracestate = util.objToString(customContext);
  }

  return headers;
}
