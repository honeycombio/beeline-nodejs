/* eslint-env node */
const api = require("./api"),
  instrumentation = require("./instrumentation"),
  propagation = require("./propagation");

let configured;

function checkIfConfigureNeeded(opts) {
  if (!configured) {
    return true;
  }

  if (opts) {
    console.warn(
      "Beeline is already configured.  Further calls are allowed but should not be passed configuration options (as they will be ignored)."
    );
  }

  return false;
}

function configureBeeline(opts) {
  configured = true;
  api.configure(opts);
  instrumentation.configure(opts);
  propagation.configure(opts);
}

function configure(opts) {
  const needConfigure = checkIfConfigureNeeded(opts);

  if (needConfigure) {
    configureBeeline(opts);
  }

  return configure;
}

// copy the api as properties on the configure function
Object.keys(api).forEach((k) => {
  if (k === "configure") {
    // skip this one, though
    return;
  }
  configure[k] = api[k];
});

configure.getInstrumentations = instrumentation.getInstrumentations;

module.exports = configure;
