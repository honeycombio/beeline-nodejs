/* eslint-env node, jest */
const DeterministicSampler = require("./deterministic_sampler");

test("it works (sample datapoints)", () => {
  // taken from honeytail's test TestDeterministicSamplerDatapoints
  let s = new DeterministicSampler(17);
  expect(s.sample("hello")).toBe(false);
  expect(s.sample("hello")).toBe(false);
  expect(s.sample("world")).toBe(false);
  expect(s.sample("this5")).toBe(true);
});

const requestIDBytes = "abcdef0123456789";

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function randomRequestID() {
  // create request ID roughly resembling something you would get from
  // AWS ALB, e.g.,
  //
  // 1-5ababc0a-4df707925c1681932ea22a20
  //
  // The AWS docs say the middle bit is "time in seconds since epoch",
  // (implying base 10) but the above represents an actual Root= ID from
  // an ALB access log, so... yeah.
  let reqID = "1-";
  for (let i = 0; i < 8; i++) {
    reqID += requestIDBytes[getRandomInt(requestIDBytes.length)];
  }
  reqID += "-";
  for (let i = 0; i < 24; i++) {
    reqID += requestIDBytes[getRandomInt(requestIDBytes.length)];
  }
  return reqID;
}

test("it works (stastically)", () => {
  const nRequestIDs = 50000;
  const acceptableMarginOfError = 0.05;

  const testSampleRates = [1, 2, 10];

  for (let sampleRate of testSampleRates) {
    let ds = new DeterministicSampler(sampleRate);
    let nSampled = 0;

    for (let i = 0; i < nRequestIDs; i++) {
      if (ds.sample(randomRequestID())) {
        nSampled++;
      }
    }

    let expectedNSampled = nRequestIDs / sampleRate;

    // Sampling should be balanced across all request IDs
    // regardless of sample rate. If we cross this threshold, flunk
    // the test.
    let unacceptableLowBound =
      (expectedNSampled - expectedNSampled * acceptableMarginOfError) >>> 0;
    let unacceptableHighBound =
      (expectedNSampled + expectedNSampled * acceptableMarginOfError) >>> 0;

    expect(nSampled).toBeGreaterThanOrEqual(unacceptableLowBound);
    expect(nSampled).toBeLessThanOrEqual(unacceptableHighBound);
  }
});
