/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api");

// This module doesn't actually *instrument* mpromise.  It exists solely to make sure our context
// propagation makes it through the various Promise callbacks.

let instrumentMPromise = Promise => {
  shimmer.wrap(Promise.prototype, "then", function(original) {
    return function then(onFulfilled, onRejected) {
      let args = [];
      if (arguments.length > 0) {
        args.push(api.bindFunctionToTrace(onFulfilled));
      }
      if (arguments.length > 1) {
        args.push(api.bindFunctionToTrace(onRejected));
      }
      return original.apply(this, args);
    };
  });

  shimmer.wrap(Promise.prototype, "catch", function(original) {
    return function then(onRejected) {
      let args = [];
      if (arguments.length > 0) {
        args.push(api.bindFunctionToTrace(onRejected));
      }
      return original.apply(this, args);
    };
  });

  shimmer.wrap(Promise.prototype, "end", function(original) {
    return function then(onRejected) {
      let args = [];
      if (arguments.length > 0) {
        args.push(api.bindFunctionToTrace(onRejected));
      }
      return original.apply(this, args);
    };
  });

  return Promise;
};

module.exports = instrumentMPromise;
