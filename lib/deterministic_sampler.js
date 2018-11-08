/* eslint-env node */
const createHash = require("crypto").createHash;

const MAX_UINT32 = Math.pow(2, 32) - 1;

module.exports = class DeterministicSampler {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.upperBound = (MAX_UINT32 / sampleRate) >>> 0;
  }

  sample(determinant) {
    let sum = createHash("sha1")
      .update(determinant)
      .digest();
    return sum.readUInt32BE(0) <= this.upperBound;
  }
};
