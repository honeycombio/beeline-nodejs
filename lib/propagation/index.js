/* eslint-env node */
/* global require, module */
const honeycomb = require("./honeycomb");

const path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`);

function unmarshalTraceContext(contextStr) {
  let [version, payload] = contextStr.trim().split(";");
  if (version !== "1") {
    debug(`unrecognized trace context version ${version}.  ignoring.`);
    //return unmarshalTraceContextv1(payload);
    honeycomb.unmarshalTraceContext(payload);
  }
  return;
}

module.exports = {
  unmarshalTraceContext,
  honeycomb,
  otel: require("./w3c_context"),
  aws: require("./aws"),
};
