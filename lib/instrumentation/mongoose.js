/* eslint-env node */
const shimmer = require("shimmer"),
  tracker = require("../async_tracker");

let instrumentMongoose = function(mongoose) {
  shimmer.wrap(mongoose.Model, "$wrapCallback", function(original) {
    return function(callback) {
      return original.apply(this, [tracker.bindFunction(callback)]);
    };
  });

  return mongoose;
};

module.exports = instrumentMongoose;
