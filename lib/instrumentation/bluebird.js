/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api");

// This module doesn't actually *instrument* bluebird.  It exists solely to make sure our context
// propagation makes it through the various Promise callbacks.

let instrumentBluebird = Promise => {
  shimmer.wrap(Promise.prototype, "_then", function(original) {
    return function _then(didFulfill, didReject, _, receiver, internalData) {
      const onFulfilled = typeof didFulfill === 'function' ? api.bindFunctionToTrace(didFulfill) : didFulfill
      const onRejected = typeof didReject === 'function' ? api.bindFunctionToTrace(didReject) : didReject
      return original.call(this, onFulfilled, onRejected, _, receiver, internalData);
    };
  });
  return Promise;
};

module.exports = instrumentBluebird;
