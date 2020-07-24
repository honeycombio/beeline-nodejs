/* global require, exports, Buffer, __dirname */
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
  let traceId = context.id;
  let spanId = util.currentSpanId(context);
  let contextToSend = context.traceContext || {};
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

function unmarshalTraceContext(contextStr) {
  // this trim and split just splits out the version from the remaining trace header
  // payload is trace header minus version
  let [version, payload] = contextStr.trim().split(";");
  switch (version) {
    case "1":
      return unmarshalTraceContextv1(payload);
  }
  debug(`unrecognized trace context version ${version}.  ignoring.`);
  return;
}

function unmarshalTraceContextv1(payload) {
  let clauses = payload.split(",");

  let traceId, parentSpanId, dataset, contextb64;

  clauses.forEach(cl => {
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
