/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api");

let instrumentMongoose = function(mongoose) {
  shimmer.wrap(mongoose.Model, "$wrapCallback", function(original) {
    return function(callback) {
      return original.apply(this, [api.bindFunctionToTrace(callback)]);
    };
  });

  return mongoose;
};

module.exports = instrumentMongoose;
