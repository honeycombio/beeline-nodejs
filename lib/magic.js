/* global require exports __dirname global */
const debug = require("debug")("honeycomb-magic"),
  shimmer = require("shimmer"),
  tracker = require("./async_tracker");

const instrumentedModules = new Set([
  "express",
  "react-dom/server",
  "mysql2",
  "http",
  "https",
  "mpromise",
  "bluebird",
  "sequelize",
  "child_process",
]);
const instrumented = new Map();

exports.activeInstrumentations = () => Array.from(instrumented.keys()).sort();

const magicPath = name => {
  name = name.replace(/\//g, "-");
  return `${__dirname}/magic/${name}-magic`;
};

let preloadDone = false;
exports.instrumentPreload = () => {
  if (preloadDone) {
    return;
  }

  preloadDone = true;
  // this really shouldn't be here.  we could load the magic modules all at configure time, and implement this as an instrumentation
  // that isn't invoked in response to a require (instead running at startup.)
  shimmer.wrap(global.Promise.prototype, "then", function(original) {
    return function then(onFulfilled, onRejected) {
      let args = [];
      if (arguments.length > 0) {
        args.push(tracker.bindFunction(onFulfilled));
      }
      if (arguments.length > 1) {
        args.push(tracker.bindFunction(onRejected));
      }
      return original.apply(this, args);
    };
  });
};

exports.instrumentLoad = (mod, loadRequest, parent) => {
  if (
    parent.id.indexOf("node_modules/honeycomb-nodejs-magic/") !== -1 ||
    !instrumentedModules.has(loadRequest)
  ) {
    // no magic here
    return mod;
  }

  if (instrumented.has(loadRequest)) {
    // we've already instrumented it
    return instrumented.get(loadRequest);
  }
  debug(`loading instrumentation for ${loadRequest}`);
  let instrumentation = require(magicPath(loadRequest));
  let new_mod;

  try {
    new_mod = instrumentation(mod);
  } catch (e) {
    debug("failed to instrument module" + loadRequest);
    new_mod = mod;
  }
  instrumented.set(loadRequest, new_mod);
  return new_mod;
};

exports.clearInstrumentationForTesting = () => {
  instrumented.clear();
};
