/* eslint-env node */
const honeycomb = require("./honeycomb"),
  aws = require("./aws"),
  w3c = require("./w3c"),
  util = require("./util"),
  hooks = require("./hooks");

exports.REQUEST_ID_HTTP_HEADER = "X-Request-ID";

exports.honeycomb = honeycomb;
exports.aws = aws;
exports.w3c = w3c;
exports.util = util;

// exported to run on require and module load with other configurations
exports.configure = hooks.configure;

exports.parseFromRequest = hooks.parseFromRequest;
exports.headersFromContext = hooks.headersFromContext;

exports.hasCustomHttpParserHook = hooks.hasCustomHttpParserHook;
