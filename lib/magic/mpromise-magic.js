const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

let instrumentMPromise = Promise => {
  shimmer.wrap(Promise.prototype, "then", function(original) {
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

  shimmer.wrap(Promise.prototype, "catch", function(original) {
    return function then(onRejected) {
      let args = [];
      if (arguments.length > 0) {
        args.push(tracker.bindFunction(onRejected));
      }
      return original.apply(this, args);
    };
  });

  shimmer.wrap(Promise.prototype, "end", function(original) {
    return function then(onRejected) {
      let args = [];
      if (arguments.length > 0) {
        args.push(tracker.bindFunction(onRejected));
      }
      return original.apply(this, args);
    };
  });

  return Promise;
};

module.exports = instrumentMPromise;
