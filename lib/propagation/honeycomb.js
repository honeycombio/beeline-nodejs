/* global require, console, exports, Buffer, __dirname */
const path = require("path"),
  pkg = require(path.join(__dirname, "..", "package.json")),
  debug = require("debug")(`${pkg.name}:propagation`),
  schema = require("./schema");

function unmarshalTraceContextv1(payload) {
    let clauses = payload.split(",");
    console.log(payload);
  
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
  
    let customContext;
    if (contextb64) {
      try {
        customContext = JSON.parse(Buffer.from(contextb64, "base64").toString("ascii"));
      } catch (e) {
        debug("couldn't decode context", e);
        return;
      }
    }
  
    return { traceId, parentSpanId, customContext, dataset };
  }

//for honeycomb trace headers
function parseHeader(header) {
    let parsed = unmarshalTraceContext(value);
    if (!parsed) {
        return {};
    }
    return Object.assign({}, parsed, {
        source: `${header} http header`,
    });
}

function unmarshalTraceContext(contextStr) {
    let [version, payload] = contextStr.trim().split(";");
    switch (version) {
      case "1":
        return unmarshalTraceContextv1(payload);
    }
    debug(`unrecognized trace context version ${version}.  ignoring.`);
    return;
}
  
exports.unmarshalTraceContext = {
    unmarshalTraceContext,
};