/* global require module */
const event = require("./event"),
  magic = require("./magic");

function configure(opts = {}) {
  event.configure(opts);
  magic.configure(opts);

  return configure;
}

configure.asyncTracker = require("./async_tracker");
configure.customContext = event.customContext;

module.exports = configure;
