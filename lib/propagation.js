/* global require, exports, Buffer, __dirname */
const path = require("path"),
  pkg = require(path.join(__dirname, "..", "package.json")),
  debug = require("debug")(`${pkg.name}:propagation`),
  schema = require("./schema");

exports.TRACE_HTTP_HEADER = "X-Honeycomb-Trace";

const VERSION = "1";
exports.VERSION = VERSION;

// assumes a header of the form:

// VERSION;PAYLOAD

// VERSION=1
// =========
// PAYLOAD is a list of comma-separated params (k=v pairs), with no spaces.  recognized
// keys + value types:
//
//  trace_id=${traceId}    - traceId is an opaque ascii string which shall not include ','
//  parent_id=${spanId}    - spanId is an opaque ascii string which shall not include ','
//  context=${contextBlob} - contextBlob is a base64 encoded json object.
//
// ex: X-Honeycomb-Trace: 1;trace_id=weofijwoeifj,parent_id=owefjoweifj,context=SGVsbG8gV29ybGQ=

exports.marshalTraceContext = marshalTraceContextv1;
function marshalTraceContextv1(traceContext) {
  let traceId = traceContext.id;
  let spanId = traceContext.stack[traceContext.stack.length - 1][schema.TRACE_SPAN_ID];
  let contextToSend = traceContext.customContext || {};

  return `${VERSION};trace_id=${traceId},parent_id=${spanId},context=${Buffer.from(
    JSON.stringify(contextToSend)
  ).toString("base64")}`;
}

exports.unmarshalTraceContext = unmarshalTraceContext;
function unmarshalTraceContext(contextStr) {
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

  let traceId, parentSpanId, contextb64;

  clauses.forEach(cl => {
    let [k, v] = cl.split("=");
    switch (k) {
      case "trace_id":
        traceId = v;
        break;
      case "parent_id":
        parentSpanId = v;
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

  let customContext;
  if (contextb64) {
    try {
      customContext = JSON.parse(Buffer.from(contextb64, "base64").toString("ascii"));
    } catch (e) {
      debug("couldn't decode context", e);
      return;
    }
  }

  return { traceId, parentSpanId, customContext };
}
