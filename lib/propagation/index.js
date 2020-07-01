/* eslint-env node */
/* global require, module */
const honeycomb = require("./honeycomb");

const path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`);

function unmarshalTraceContext(traceHeader) {
  // split trace header into separate strings
  let [version, payload] = traceHeader.trim().split(";");
  if (version === "1") {
    return unmarshalTraceContextv1(payload);
    //honeycomb.unmarshalTraceContext(payload);
  }
  else {
    debug(`unrecognized trace context version ${version}.  ignoring.`);
    return;
  }
}

function unmarshalTraceContextv1(traceHeader) {

}

module.exports = {
  unmarshalTraceContext,
  honeycomb,
  otel: require("./w3c_context"),
  aws: require("./aws"),
};
