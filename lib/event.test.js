/* global require beforeEach afterEach describe test expect __dirname */
const path = require("path"),
  event = require("./event"),
  schema = require("./schema"),
  tracker = require("./async_tracker"),
  pkg = require(path.join(__dirname, "..", "package.json"));

beforeEach(() =>
  event.configure({ api: "libhoney-event", transmission: "mock", writeKey: "abc123" }));
afterEach(() => event.resetForTesting());
test("libhoney default config", () => {
  const honey = event.apiForTesting().honey;
  expect(honey.transmission.constructorArg.apiHost).toBe("https://api.honeycomb.io");
  expect(honey.transmission.constructorArg.dataset).toBe("nodejs");
  expect(honey.transmission.constructorArg.writeKey).toBe("abc123");
  expect(honey.transmission.constructorArg.userAgentAddition).toBe(
    `honeycomb-beeline/${pkg.version}`
  );
});

test("startRequest starts tracking and creates an initial event, finishRequest sends it", () => {
  const honey = event.apiForTesting().honey;
  expect(tracker.getTracked()).toBeUndefined(); // context should be empty initially

  let eventPayload = event.startRequest("source", "name");

  // starting a request creates a context
  let context = tracker.getTracked();
  expect(context).not.toBeUndefined();

  // the stack consists solely of the request's event
  expect(context.stack).toEqual([eventPayload]);
  // and it should have these properties
  expect(eventPayload[schema.EVENT_TYPE]).toBe("source");
  let traceId = eventPayload[schema.TRACE_ID];
  expect(traceId).not.toBeUndefined();
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
  expect(postData[schema.EVENT_TYPE]).toBe("source");
  expect(postData[schema.TRACE_SPAN_NAME]).toBe("name");
  expect(postData[schema.TRACE_ID]).toBe(traceId);
  expect(postData[schema.TRACE_PARENT_ID]).toBeUndefined();
  expect(postData[schema.TRACE_SPAN_ID]).toBe(traceId);
  expect(postData[schema.DURATION_MS]).not.toBeUndefined();
});

test("ending events out of order isn't allowed", () => {
  let eventPayload = event.startRequest("source", "name");
  let context = tracker.getTracked();

  expect(context.stack).toEqual([eventPayload]);

  let event2Payload = event.startEvent(context, "source2", "name2");
  let event3Payload = event.startEvent(context, "source3", "name3");
  expect(context.stack).toEqual([eventPayload, event2Payload, event3Payload]);

  // if we end event2Payload from the stack, we should also remove event3Payload.
  event.finishEvent(event2Payload);
  expect(context.stack).toEqual([eventPayload]);

  // if we finish event3 now, nothing should happen to the stack
  event.finishEvent(event3Payload);
  expect(context.stack).toEqual([eventPayload]);
});

test("sub-events can opt to rollup count/duration into request events", () => {
  let requestPayload = event.startRequest("source", "name");
  let context = tracker.getTracked();

  let eventPayload = event.startEvent(context, "source2", "name2");
  event.finishEvent(eventPayload, "rollup");

  let durationMS = eventPayload[schema.DURATION_MS];
  expect(requestPayload["totals.source2_rollup_count"]).toBe(1);
  expect(requestPayload["totals.source2_rollup_duration_ms"]).toBe(durationMS);

  // another event from the same source
  let event2Payload = event.startEvent(context, "source2", "name2");
  event.finishEvent(event2Payload, "rollup");

  let duration2MS = event2Payload[schema.DURATION_MS];
  expect(requestPayload["totals.source2_rollup_count"]).toBe(2);
  expect(requestPayload["totals.source2_rollup_duration_ms"]).toBe(durationMS + duration2MS);

  // these rollup to the instrumentation/source-level as well:
  expect(requestPayload["totals.source2_count"]).toBe(2);
  expect(requestPayload["totals.source2_duration_ms"]).toBe(durationMS + duration2MS);

  // one more event from the same source but a different name
  let event3Payload = event.startEvent(context, "source2");
  event.finishEvent(event3Payload, "rollup2");

  let duration3MS = event3Payload[schema.DURATION_MS];
  expect(requestPayload["totals.source2_rollup2_count"]).toBe(1);
  expect(requestPayload["totals.source2_rollup2_duration_ms"]).toBe(duration3MS);

  // it doesn't touch the "rollup" rollup
  expect(requestPayload["totals.source2_rollup_count"]).toBe(2);
  expect(requestPayload["totals.source2_rollup_duration_ms"]).toBe(durationMS + duration2MS);

  // but it does get rolled into the instrumentation/source-level rollup:
  expect(requestPayload["totals.source2_count"]).toBe(3);
  expect(requestPayload["totals.source2_duration_ms"]).toBe(durationMS + duration2MS + duration3MS);
});

test("sub-events will get manual tracing fields", () => {
  const honey = event.apiForTesting().honey;

  let requestPayload = event.startRequest("source", "name");
  let context = tracker.getTracked();

  let eventPayload = event.startEvent(context, "source2", "name2");
  event.finishEvent(eventPayload);

  // finish the request
  event.finishRequest(requestPayload);

  // libhoney should have been told to send two events
  expect(honey.transmission.events.length).toBe(2);

  let subEventData = JSON.parse(honey.transmission.events[0].postData);
  let reqEventData = JSON.parse(honey.transmission.events[1].postData);

  expect(subEventData[schema.TRACE_PARENT_ID]).toBe(reqEventData[schema.TRACE_SPAN_ID]);
  expect(subEventData[schema.TRACE_ID]).toBe(reqEventData[schema.TRACE_ID]);
  expect(subEventData[schema.TRACE_SPAN_NAME]).toBe("name2");
});

describe("custom context", () => {
  test("it should be added to request events", () => {
    const honey = event.apiForTesting().honey;

    let requestPayload = event.startRequest("source", "name");

    event.customContext.add("testKey", "testVal");

    // finish the request
    event.finishRequest(requestPayload);

    let requestData = JSON.parse(honey.transmission.events[0].postData);
    expect(requestData[schema.customContext("testKey")]).toBe("testVal");
  });

  test("removing it works too", () => {
    const honey = event.apiForTesting().honey;

    let requestPayload = event.startRequest("source", "name");

    event.customContext.add("testKey", "testVal");

    event.customContext.remove("testKey");

    // finish the request
    event.finishRequest(requestPayload);

    let requestData = JSON.parse(honey.transmission.events[0].postData);
    expect(requestData[schema.customContext("testKey")]).toBeUndefined();
  });

  test("it should be added to subevents sent after it was added", () => {
    const honey = event.apiForTesting().honey;

    let requestPayload = event.startRequest("source", "name");
    let context = tracker.getTracked();

    let eventPayload = event.startEvent(context, "source2", "name2");
    event.finishEvent(eventPayload);

    event.customContext.add("testKey", "testVal");

    let eventPayload2 = event.startEvent(context, "source3", "name3");
    event.finishEvent(eventPayload2);

    // finish the request
    event.finishRequest(requestPayload);

    // libhoney should have been told to send two events
    expect(honey.transmission.events.length).toBe(3);

    let subEventData = JSON.parse(honey.transmission.events[0].postData);
    let subEvent2Data = JSON.parse(honey.transmission.events[1].postData);
    let reqEventData = JSON.parse(honey.transmission.events[2].postData);

    // make sure we grabbed the right events
    expect(reqEventData[schema.EVENT_TYPE]).toBe("source");
    expect(subEventData[schema.EVENT_TYPE]).toBe("source2");
    expect(subEvent2Data[schema.EVENT_TYPE]).toBe("source3");

    // these should have the custom context
    expect(reqEventData[schema.customContext("testKey")]).toBe("testVal");
    expect(subEvent2Data[schema.customContext("testKey")]).toBe("testVal");

    // but the first event (sent before the context was added) won't:
    expect(subEventData[schema.customContext("testKey")]).toBeUndefined();
  });
});
