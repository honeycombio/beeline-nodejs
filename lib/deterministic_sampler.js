/* global require module */
const createHash = require("crypto").createHash;

const MAX_UINT32 = Math.pow(2, 32) - 1;

module.exports = class DeterministicSampler {
  constructor(sampleRate) {
    this.upperBound = MAX_UINT32 / sampleRate;
  }

  lastFourBytesToUint32(b) {
    let bufLen = b.length;
    return (
      ((b[bufLen - 1] >>> 0) |
        ((b[bufLen - 2] << 8) >>> 0) |
        ((b[bufLen - 3] << 16) >>> 0) |
        ((b[bufLen - 4] << 24) >>> 0)) >>>
      0
    );
  }

  sample(determinant) {
    let sum = createHash("sha1")
      .update(determinant)
      .digest();
    return this.lastFourBytesToUint32(sum) < this.upperBound;
  }
};
