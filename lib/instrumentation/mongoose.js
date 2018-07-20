/* eslint-env node */
const shimmer = require("shimmer"),
  event = require("../event_api");

let instrumentMongoose = function(mongoose) {
  shimmer.wrap(mongoose.Model, "$wrapCallback", function(original) {
    return function(callback) {
      return original.apply(this, [event.bindFunctionToTrace(callback)]);
    };
  });

  return mongoose;
};

module.exports = instrumentMongoose;
