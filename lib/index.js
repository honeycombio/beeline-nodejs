/* eslint-env node */
const event = require("./event_api"),
  instrumentation = require("./instrumentation"),
  propagation = require("./propagation");

function configure(opts = {}) {
  event.configure(opts);
  instrumentation.configure(opts);

  return configure;
}

configure.asyncTracker = require("./async_tracker");
configure.customContext = event.customContext;

configure.marshalTraceContext = propagation.marshalTraceContext;
configure.unmarshalTraceContext = propagation.unmarshalTraceContext;

module.exports = configure;
