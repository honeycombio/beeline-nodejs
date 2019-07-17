/* eslint-env node */
// const onHeaders = require("on-headers"),
// shimmer = require("shimmer"),
// flatten = require("array-flatten"),
// tracker = require("../async_tracker"),
// schema = require("../schema"),
// api = require("../api"),
// util = require("../util"),
// path = require("path"),
// pkg = require(path.join(__dirname, "..", "..", "package.json")),
// traceUtil = require("trace-util"),
// debug = require("debug")(`${pkg.name}:fastify`);

let instrumentFastify = function(fastify, _opts = {}) {
  // let userContext, traceIdSource;
  // if (opts.userContext) {
  //   if (Array.isArray(opts.userContext) || typeof opts.userContext === "function") {
  //     userContext = opts.userContext;
  //   } else {
  //     debug(
  //       "userContext option must either be an array of field names or a function returning an object"
  //     );
  //   }
  // }
  // if (opts.traceIdSource) {
  //   if (typeof opts.traceIdSource === "string" || typeof opts.traceIdSource === "function") {
  //     traceIdSource = opts.traceIdSource;
  //   } else {
  //     debug(
  //       "traceIdSource option must either be an string (the http header name) or a function returning the string request id"
  //     );
  //   }
  // }
};

module.exports = instrumentFastify;
