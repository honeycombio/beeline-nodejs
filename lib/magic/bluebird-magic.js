const shimmer = require("shimmer"),
  tracker = require("../async_tracker"),
  event = require("../event");

let instrumentBluebird = Promise => {
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

  shimmer.wrap(Promise.prototype, "caught", function(original) {
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

module.exports = instrumentBluebird;
