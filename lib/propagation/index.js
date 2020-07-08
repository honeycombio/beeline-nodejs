/* eslint-env node */
/* global require, exports */
const honeycomb = require("./honeycomb");

const path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`);

// unmarshalTraceContext takes a trace header (string)
// and returns a span context object
exports.unmarshalTraceContext = unmarshalTraceContext;

function unmarshalTraceContext(traceHeader) {
  honeycomb.unmarshalHoneycombTraceContextV1(traceHeader);
}

// marshalTraceContext takes a span context object
// and returns a trace header (string)
exports.marshalTraceContext = marshalTraceContext;

function marshalTraceContext(context) {
  honeycomb.marshalHoneycombTraceContext(context);
}
