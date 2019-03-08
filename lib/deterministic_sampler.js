/* eslint-env node */
const createHash = require("crypto").createHash;
const schema = require("./schema");

const MAX_UINT32 = Math.pow(2, 32) - 1;

module.exports = function(sampleRate) {
  return function(eventData) {
    const sum = createHash("sha1")
      .update(eventData[schema.TRACE_ID])
      .digest();
    const upperBound = (MAX_UINT32 / sampleRate) >>> 0;

    return {
      shouldSample: sum.readUInt32BE(0) <= upperBound,
      sampleRate: sampleRate,
    };
  };
};
