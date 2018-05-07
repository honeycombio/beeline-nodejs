/* global require module */
const event = require("./event"),
  instrumentation = require("./instrumentation");

function configure(opts = {}) {
  event.configure(opts);
  instrumentation.configure(opts);

  return configure;
}

configure.asyncTracker = require("./async_tracker");
configure.customContext = event.customContext;

module.exports = configure;
