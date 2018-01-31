const shimmer = require("shimmer"),
  Module = require("module"),
  event = require("./event"),
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
]);
const instrumented = new Map();

const magicPath = name => {
  name = name.replace(/\//g, "-");
  return `${__dirname}/magic/${name}-magic`;
};

shimmer.wrap(Module, "_load", function(original) {
  return function(request, parent, isMain) {
    let m = original.apply(this, [request, parent, isMain]);
    if (
      parent.id.indexOf("node_modules/honeycomb-nodejs-magic/") !== -1 ||
      !instrumentedModules.has(request)
    ) {
      // no magic here
      return m;
    }

    if (instrumented.has(request)) {
      // we've already instrumented it
      return instrumented.get(request);
    }
    console.log(`loading instrumentation for ${request}`);
    let instrumentation = require(magicPath(request));
    let new_m = instrumentation(m);
    instrumented.set(request, new_m);
    return new_m;
  };
});

if (global.Promise) {
  shimmer.wrap(global.Promise.prototype, "then", function(original) {
    return function then(onFulfilled, onRejected) {
      let args = [];
      if (arguments.length > 0) {
        args.push(
          typeof onFulfilled === "function" ? tracker.bindFunction(onFulfilled) : onFulfilled
        );
      }
      if (arguments.length > 1) {
        args.push(typeof onRejected === "function" ? tracker.bindFunction(onRejected) : onRejected);
      }
      return original.apply(this, args);
    };
  });
}

module.exports = opts => {
  event.configure(opts);

  return {
    asyncTracker: require("./async_tracker"),
    customContext: event.customContext,
  };
};
