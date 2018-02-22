/* global require beforeEach afterEach test expect __dirname */
const path = require("path"),
  event = require("./event"),
  tracker = require("./async_tracker"),
  pkg = require(path.join(__dirname, "..", "package.json"));

beforeEach(() =>
  event.configure({ api: "libhoney-event", transmission: "mock", writeKey: "abc123" })
);
afterEach(() => event.resetForTesting());
test("libhoney default config", () => {
  const honey = event.apiForTesting().honey;
  expect(honey.transmission.constructorArg.apiHost).toBe("https://api.honeycomb.io");
  expect(honey.transmission.constructorArg.dataset).toBe("nodejs");
  expect(honey.transmission.constructorArg.writeKey).toBe("abc123");
  expect(honey.transmission.constructorArg.userAgentAddition).toBe(
    `honeycomb-nodejs ${pkg.version} events`
  );
});

test("startRequest starts tracking and creates an initial event, finishRequest sends it", () => {
  const honey = event.apiForTesting().honey;
  expect(tracker.getTracked()).toBeUndefined(); // context should be empty initially

  let eventPayload = event.startRequest("source");

  // starting a request creates a context
  let context = tracker.getTracked();
  expect(context).not.toBeUndefined();

  // the stack consists solely of the request's event
  expect(context.stack).toEqual([eventPayload]);
  // and it should have these properties
  expect(eventPayload["meta.type"]).toBe("source");
  let requestId = eventPayload["meta.request_id"];
  expect(requestId).not.toBeUndefined();
  let startTime = eventPayload.startTime;
  expect(startTime).not.toBeUndefined();

  // libhoney shouldn't have been told to send anything yet
  expect(honey.transmission.events).toEqual([]);

  // finish the request
  event.finishRequest(eventPayload);
  expect(tracker.getTracked()).toBeUndefined(); // context should be cleared

  // libhoney should have been told to send one event
  expect(honey.transmission.events.length).toBe(1);
  let sent = honey.transmission.events[0];
  let postData = JSON.parse(sent.postData);
  expect(sent.timestamp).toEqual(new Date(startTime));
  expect(postData["meta.type"]).toBe("source");
  expect(postData["meta.request_id"]).toBe(requestId);
  expect(postData["duration_ms"]).not.toBeUndefined();
});

test("ending events out of order isn't allowed", () => {
  let eventPayload = event.startRequest("source");
  let context = tracker.getTracked();

  expect(context.stack).toEqual([eventPayload]);

  let event2Payload = event.startEvent(context, "source2");
  let event3Payload = event.startEvent(context, "source3");
  expect(context.stack).toEqual([eventPayload, event2Payload, event3Payload]);

  // if we end event2Payload from the stack, we should also remove event3Payload.
  event.finishEvent(event2Payload);
  expect(context.stack).toEqual([eventPayload]);

  // if we finish event3 now, nothing should happen to the stack
  event.finishEvent(event3Payload);
  expect(context.stack).toEqual([eventPayload]);
});

test("sub-events can opt to rollup count/duration into request events", () => {
  let requestPayload = event.startRequest("source");
  let context = tracker.getTracked();

  let eventPayload = event.startEvent(context, "source2");
  event.finishEvent(eventPayload, "rollup");

  let durationMS = eventPayload.duration_ms;
  expect(requestPayload["source.totalSource2Rollup_count"]).toBe(1);
  expect(requestPayload["source.totalSource2RollupDuration_ms"]).toBe(durationMS);

  // another event from the same source
  let event2Payload = event.startEvent(context, "source2");
  event.finishEvent(event2Payload, "rollup");

  let duration2MS = event2Payload.duration_ms;
  expect(requestPayload["source.totalSource2Rollup_count"]).toBe(2);
  expect(requestPayload["source.totalSource2RollupDuration_ms"]).toBe(durationMS + duration2MS);
});

test("events can specify the column name used to store event duration_ms", () => {
  let requestPayload = event.startRequest("source");

  event.finishRequest(requestPayload, "myOwnSpecialDurationMsField");

  expect(requestPayload.myOwnSpecialDurationMsField).not.toBeUndefined();
});
