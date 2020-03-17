/* eslint-env node */
const process = require("process"),
  schema = require("../schema");

module.exports = class Span {
  constructor(payload) {
    this.payload = payload;
    this.startTime = Date.now();
    this.startTimeHR = process.hrtime();
  }

  addContext(map) {
    Object.assign(this.payload, map);
  }

  finalizePayload() {
    let rv = Object.assign({}, this.payload);
    const duration = process.hrtime(this.startTimeHR);
    const durationMs = (duration[0] * 1e9 + duration[1]) / 1e6;
    rv[schema.DURATION_MS] = durationMs;
    return rv;
  }
};
