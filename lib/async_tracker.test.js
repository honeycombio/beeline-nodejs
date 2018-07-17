/* eslint-env node, jest */
const tracker = require("./async_tracker");

test("local (non-continuation-based) tracked access", () => {
  let payload = {};
  tracker.setTracked(payload);
  expect(tracker.getTracked()).toBe(payload);
  tracker.deleteTracked();
  expect(tracker.getTracked()).toBeUndefined();
});

test("runWithoutTracking runs the function without a current payload", () => {
  let payload = {};
  tracker.setTracked(payload);
  tracker.runWithoutTracking(() => {
    expect(tracker.getTracked()).toBeUndefined();
  });
  expect(tracker.getTracked()).toBe(payload);
});

test("bindFunction returns a function that installs the payload", () => {
  let payload = {};
  tracker.setTracked(payload);

  let fn = tracker.bindFunction(() => {
    expect(tracker.getTracked()).toBe(payload);
  });
  tracker.deleteTracked();
  expect(tracker.getTracked()).toBeUndefined();
  fn();
  expect(tracker.getTracked()).toBeUndefined();
});

test("callbacks are automatically attached to their parent context's payload", done => {
  let payload = {};
  tracker.setTracked(payload);

  let run = false;
  setTimeout(() => {
    run = true;
    expect(tracker.getTracked()).toBe(payload);
    done();
  }, 100);

  // this line will run before the body of the timeout callback above (extra assertion here in case we turn on jest mock timers)
  expect(run).toBe(false);
  tracker.deleteTracked();
});
