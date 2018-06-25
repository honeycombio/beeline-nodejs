/* global require, exports, Buffer, __dirname */
const path = require("path"),
  pkg = require(path.join(__dirname, "..", "package.json")),
  debug = require("debug")(`${pkg.name}:propagation`),
  schema = require("./schema");

const VERSION = "1";

// assumes a header of the form:

// VERSION;PAYLOAD

// VERSION=1
// =========
// PAYLOAD is a list of comma-separated params (k=v pairs), with no spaces.  recognized
// keys + value types:
//
//  trace=${traceId}       - traceId is an opaque ascii string which shall not include ','
//  span=${spanId}         - spanId is an opaque ascii string which shall not include ','
//  context=${contextBlob} - contextBlob is a base64 encoded json object.
//
// ex: X-Honeycomb-Trace: 1;trace=weofijwoeifj,span=owefjoweifj,context=SGVsbG8gV29ybGQ=

exports.getTraceContext = getTraceContextv1;
function getTraceContextv1(context) {
  let traceId = context.id;
  let spanId = context.stack[context.stack.length - 1][schema.TRACE_SPAN_ID];
  let contextToSend = { a: 1 };

  return `${VERSION};trace=${traceId},span=${spanId},context=${Buffer.from(
    JSON.stringify(contextToSend)
  ).toString("base64")}`;
}

exports.parseTraceContext = parseTraceContext;
function parseTraceContext(context) {
  let [version, payload] = context.trim().split(";");
  switch (version) {
    case "1":
      return parseTraceContextv1(payload);
  }
  debug(`unrecognized trace context version ${version}.  ignoring.`);
  return;
}

function parseTraceContextv1(payload) {
  let clauses = payload.split(",");

  let traceId, spanId, contextb64;

  clauses.forEach(cl => {
    let [k, v] = cl.split("=");
    switch (k) {
      case "trace":
        traceId = v;
        break;
      case "span":
        spanId = v;
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
    debug("no traceId in header");
    return;
  }

  if (!spanId) {
    debug("no spanId in header");
    return;
  }

  let context;
  if (contextb64) {
    context = JSON.parse(Buffer.from(contextb64, "base64").toString("ascii"));
  }

  return { traceId, spanId, context };
}
