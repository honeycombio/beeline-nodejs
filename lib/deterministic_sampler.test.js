/* global require test expect */
const DeterministicSampler = require("./deterministic_sampler");

test("it works (sample datapoints)", () => {
  // taken from honeytail's test TestDeterministicSamplerDatapoints
  let s = new DeterministicSampler(17);
  expect(s.sample("hello")).toBe(false);
  expect(s.sample("hello")).toBe(false);
  expect(s.sample("world")).toBe(false);
  expect(s.sample("this5")).toBe(false);
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

/*
+func TestDeterministicSampler(t *testing.T) {
    +       const (
    +               nRequestIDs             = 200000
    +               acceptableMarginOfError = 0.05
    +       )
    +
    +       testSampleRates := []uint{1, 2, 10, 50, 100}
    +
    +       // distribution for sampling should be good
    +       for _, sampleRate := range testSampleRates {
    +               ds, err := NewDeterministicSampler(sampleRate)
    +               if err != nil {
    +                       t.Fatalf("error creating deterministic sampler: %s", err)
    +               }
    +
    +               nSampled := 0
    +
    +               for i := 0; i < nRequestIDs; i++ {
    +                       sampled := ds.Sample(randomRequestID())
    +                       if sampled {
    +                               nSampled++
    +                       }
    +               }
    +
    +               expectedNSampled := (nRequestIDs * (1 / float64(sampleRate)))
    +
    +               // Sampling should be balanced across all request IDs
    +               // regardless of sample rate. If we cross this threshold, flunk
    +               // the test.
    +               unacceptableLowBound := int(expectedNSampled - (expectedNSampled * acceptableMarginOfError))
    +               unacceptableHighBound := int(expectedNSampled + (expectedNSampled * acceptableMarginOfError))
    +               if nSampled < unacceptableLowBound || nSampled > unacceptableHighBound {
    +                       t.Fatal("Sampled more or less than we should have: ", nSampled, "(sample rate ", sampleRate, ")")
    +               }
    +       }
    +
    +       s1, _ := NewDeterministicSampler(2)
    +       s2, _ := NewDeterministicSampler(2)
    +       sampleString := "#hashbrowns"
    +       firstAnswer := s1.Sample(sampleString)
    +
    +       // sampler should not give different answers for subsequent runs
    +       for i := 0; i < 25; i++ {
    +               s1Answer := s1.Sample(sampleString)
    +               s2Answer := s2.Sample(sampleString)
    +               if s1Answer != firstAnswer || s2Answer != firstAnswer {
    +                       t.Fatalf("deterministic samplers were not deterministic:\n\titeration: %d\n\ts1Answer was %t\n\ts2Answer was %t\n\tfirstAnswer was %t", i, s1Answer, s2Answer, firstAnswer)
    +               }
    +       }
    +}
    */
