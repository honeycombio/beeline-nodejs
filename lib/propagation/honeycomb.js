/* eslint-env node */
const path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:propagation`),
  util = require("./util");

const TRACE_HTTP_HEADER = "X-Honeycomb-Trace";
exports.TRACE_HTTP_HEADER = TRACE_HTTP_HEADER;

const VERSION = "1";
exports.VERSION = VERSION;

// assumes a header of the form:

// VERSION;PAYLOAD

// VERSION=1
// =========
// PAYLOAD is a list of comma-separated params (k=v pairs), with no spaces.  recognized
// keys + value types:
//
//  trace_id=${traceId}     - traceId is an opaque ascii string which shall not include ','
//  parent_id=${spanId}     - spanId is an opaque ascii string which shall not include ','
//  dataset=${datasetId}   - datasetId is the slug for the honeycomb dataset to which downstream spans should be sent; shall not include ','
//  context=${contextBlob}  - contextBlob is a base64 encoded json object.
//
// ex: X-Honeycomb-Trace: 1;trace_id=weofijwoeifj,parent_id=owefjoweifj,context=SGVsbG8gV29ybGQ=

// marshalTraceContext takes a trace context object
// and returns a serialized honeycomb trace header
exports.marshalTraceContext = marshalTraceContextv1;

function marshalTraceContextv1(context) {
  // expect propagation context structure
  // fall back to execution context structure for backwards compatibility
  let traceId = context.traceId || context.id;
  let spanId = context.parentSpanId || util.currentSpanId(context);
  let contextToSend = context.customContext || context.traceContext || {};
  let dataset = context.dataset;

  let datasetClause = "";
  if (dataset) {
    datasetClause = `dataset=${encodeURIComponent(dataset)},`;
  }

  return `${VERSION};trace_id=${traceId},parent_id=${spanId},${datasetClause}context=${Buffer.from(
    JSON.stringify(contextToSend)
  ).toString("base64")}`;
}

// unmarshalTraceContext takes a string trace header and returns a context
exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(header) {
  // this trim and split just splits out the version from the remaining trace header
  // payload is trace header minus version
  try {
    let [version, payload] = header.trim().split(";");
    switch (version) {
      case "1":
        return unmarshalTraceContextv1(payload);
    }
    debug(`unrecognized trace context version ${version}.  ignoring.`);
    return;
  } catch (error) {
    debug(
      `error: ${error},
       unable to parse trace header: expected string value of "x-honeycomb-trace", received ${header}`
    );
  }
}

function unmarshalTraceContextv1(payload) {
  let clauses = payload.split(",");

  let traceId, parentSpanId, dataset, contextb64;

  clauses.forEach((cl) => {
    let [k, v] = cl.split("=", 2);
    switch (k) {
      case "trace_id":
        traceId = v;
        break;
      case "parent_id":
        parentSpanId = v;
        break;
      case "dataset":
        dataset = decodeURIComponent(v);
        break;
      case "context":
        contextb64 = v;
        break;
      default:
        debug(`unrecognized key '${k}', skipping.`);
        break;
    }
  });

  if (!traceId) {
    debug("no trace_id in header");
    return;
  }

  if (!parentSpanId) {
    debug("no parent_id in header");
    return;
  }

  let traceContext;
  if (contextb64) {
    try {
      traceContext = JSON.parse(Buffer.from(contextb64, "base64").toString("ascii"));
    } catch (e) {
      debug("couldn't decode context", e);
      return;
    }
  }

  return {
    traceId,
    parentSpanId,

    // trace level fields go into customContext
    // these will propagate unchanged
    customContext: traceContext,
    dataset,
  };
}

exports.httpTraceParserHook = httpTraceParserHook;

function httpTraceParserHook(httpReq) {
  const traceHeaderValue = httpReq.headers[TRACE_HTTP_HEADER.toLowerCase()];
  if (!traceHeaderValue) {
    return null;
  }
  return unmarshalTraceContext(traceHeaderValue);
}

exports.httpTracePropagationHook = httpTracePropagationHook;

function httpTracePropagationHook(context = {}) {
  // tracestate default to undefined so it will only be included when needed
  let headers = {
    [TRACE_HTTP_HEADER]: marshalTraceContextv1(context),
  };

  // add tracestate if there are fields in traceContext
  const { customContext } = context;

  if (customContext.tracestate) {
    headers.tracestate = customContext.tracestate;
  }

  return headers;
}
