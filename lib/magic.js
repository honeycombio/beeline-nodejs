/* global require exports __dirname global console */
const debug = require("debug")("honeycomb-magic:magic"),
  shimmer = require("shimmer"),
  tracker = require("./async_tracker"),
  Module = require("module");

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
const instrumentPreload = (exports.instrumentPreload = () => {
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
});

const instrumentLoad = (exports.instrumentLoad = (mod, loadRequest, parent, opts = {}) => {
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
    new_mod = instrumentation(mod, opts);
  } catch (e) {
    debug("failed to instrument module" + loadRequest);
    new_mod = mod;
  }
  instrumented.set(loadRequest, new_mod);
  return new_mod;
});

const checkForAlreadyRequiredModules = () => {
  let modulesRequired = [];

  for (let m of instrumentedModules.values()) {
    try {
      // try to resolve our known modules in the context of the main module
      let resolvedPath = require.resolve(m, { paths: require.main.paths });

      // if the resolved path is in the cache, the module has been required.
      if (require.cache[resolvedPath]) {
        modulesRequired.push(m);
      }
    } catch (e) {
      // require.resolve() throws if it can't find a module. we can safely
      // ignore it and continue our loop (it just means that the app requiring
      // us doesn't use that module.)
    }
  }
  if (modulesRequired.length > 0) {
    console.error(
      `The following modules were required before honeycomb-nodejs-magic: ${modulesRequired}
These modules will not be instrumented.  Please ensure honeycomb-nodejs-magic is required first.`
    );
  }
};

exports.configure = (opts = {}) => {
  if (!opts.__disableModuleLoadMagic) {
    checkForAlreadyRequiredModules();

    shimmer.wrap(Module, "_load", function(original) {
      return function(request, parent, isMain) {
        let mod = original.apply(this, [request, parent, isMain]);
        return instrumentLoad(mod, request, parent, opts[request] || {});
      };
    });
  }
  instrumentPreload();
};

exports.clearInstrumentationForTesting = () => {
  instrumented.clear();
};
