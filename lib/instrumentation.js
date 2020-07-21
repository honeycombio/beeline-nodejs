/* eslint-env node */
const shimmer = require("shimmer"),
  tracker = require("./async_tracker"),
  Module = require("module"),
  process = require("process"),
  path = require("path"),
  pkg = require(path.join(__dirname, "..", "package.json")),
  debug = require("debug")(`${pkg.name}:instrumentation`);

const instrumentations = [
  "bluebird",
  "child_process",
  "express",
  "fastify",
  "http",
  "https",
  "mongodb",
  "mongoose",
  "mpromise",
  "mysql2",
  "pg",
  "react-dom/server",
  "sequelize",
];

let enabledInstrumentations = new Set(instrumentations);
const instrumentedPaths = new Map();
const instrumentationsActive = new Set();
exports.activeInstrumentations = () => Array.from(instrumentationsActive.keys()).sort();

const instrumentationPath = name => {
  name = name.replace(/\//g, "-");
  return `${__dirname}/instrumentation/${name}`;
};

let preloadDone = false;
const instrumentPreload = (exports.instrumentPreload = () => {
  if (preloadDone) {
    return;
  }

  preloadDone = true;
  // this really shouldn't be here.  we could load the instrumentation modules all at configure time, and implement this as an instrumentation
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

// arguments are the same as to require.resolve.
function getPackageVersion(request, options) {
  // treat `require("react-dom/server")` like `require("react-dom")` here
  if (request.includes("/")) {
    request = request.slice(0, request.indexOf("/"));
  }
  try {
    return require(require.resolve(`${request}/package.json`, options)).version;
  } catch (e) {
    // this will throw for builtin node modules (they have no package.json).
    // make sure that's what we're dealing with.
    let resolvedPath = require.resolve(request, options);
    if (resolvedPath === request) {
      // builtin module, return node version
      return process.version;
    }
    return null;
  }
}

const instrumentLoad = (exports.instrumentLoad = (mod, loadRequest, parent, opts = {}) => {
  if (parent.id.includes(`node_modules/${pkg.name}`) || !enabledInstrumentations.has(loadRequest)) {
    // no magic here
    return mod;
  }

  let resolvedPath;
  try {
    // this can throw if a module isn't found (presumably the corresponding `require` in application code is also wrapped with a try/catch?)
    resolvedPath = require.resolve(loadRequest, parent);
  } catch (e) {
    debug(`couldn't resolve ${loadRequest}: ${e}`);
  }

  if (!resolvedPath) {
    debug(`module ${loadRequest} was loaded but require.resolve failed.`);
    return mod;
  }

  if (instrumentedPaths.has(resolvedPath)) {
    // we've already instrumented it
    return instrumentedPaths.get(resolvedPath);
  }

  let packageVersion = getPackageVersion(loadRequest, parent);
  debug(`loading instrumentation for ${loadRequest}@${packageVersion}`);

  // set instrumentation as the instrumentation function i.e. instrumentHTTP
  // and require it
  let instrumentation = require(instrumentationPath(loadRequest));
  let new_mod;

  try {
    new_mod = instrumentation(mod, Object.assign({ packageVersion }, opts));
  } catch (e) {
    debug("failed to instrument module" + resolvedPath);
    new_mod = mod;
  }

  instrumentedPaths.set(resolvedPath, new_mod);
  instrumentationsActive.add(loadRequest);
  return new_mod;
});

const checkForAlreadyRequiredModules = () => {
  let modulesRequired = [];

  for (let m of enabledInstrumentations.values()) {
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
      `The following modules were required before ${pkg.name}: ${modulesRequired}
These modules will not be instrumented.  Please ensure ${pkg.name} is required first.`
    );
  }
};

exports.configure = (opts = {}) => {
  if (opts.disableInstrumentation) {
    return;
  }

  if (opts.enabledInstrumentations !== undefined) {
    enabledInstrumentations = new Set(opts.enabledInstrumentations);
  }

  if (!opts.disableInstrumentationOnLoad) {
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

exports.getInstrumentations = () => instrumentations.slice();

exports.clearInstrumentationForTesting = () => {
  enabledInstrumentations = new Set(instrumentations);
  instrumentationsActive.clear();
  instrumentedPaths.clear();
};
