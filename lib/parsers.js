/* eslint-env node */
const oteltrace = require("@opentelemetry/api");
const { TraceAPI } = require("@opentelemetry/api/build/src/api/trace");

function getContext(req) {
  console.log("get context");
  console.log(req);
}

module.exports.parse = {
  getContext,
};
