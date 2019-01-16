/* eslint-env node */
const api = require("./api"),
  instrumentation = require("./instrumentation");

function configure(opts = {}) {
  api.configure(opts);
  instrumentation.configure(opts);

  return configure;
}

// copy the api as properties on the configure function
Object.keys(api).forEach(k => {
  if (k === "configure") {
    // skip this one, though
    return;
  }
  configure[k] = api[k];
});

configure.getInstrumentations = instrumentation.getInstrumentations;

module.exports = configure;
