/* eslint-env node, jest */
const path = require("path"),
  event = require("."),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  propagation = require("../propagation"),
  pkg = require(path.join(__dirname, "..", "..", "package.json"));

beforeEach(() =>
  event.configure({ impl: "libhoney-event", transmission: "mock", writeKey: "abc123" }));
afterEach(() => event._resetForTesting());
test("libhoney default config", () => {
  const honey = event._apiForTesting().honey;
  expect(honey.transmission.constructorArg.apiHost).toBe("https://api.honeycomb.io");
  expect(honey.transmission.constructorArg.dataset).toBe("nodejs");
  expect(honey.transmission.constructorArg.writeKey).toBe("abc123");
  expect(honey.transmission.constructorArg.userAgentAddition).toBe(
    `honeycomb-beeline/${pkg.version}`
  );
});

test("startTrace starts tracking and creates an initial event, finishTrace sends it", () => {
  const honey = event._apiForTesting().honey;
  expect(tracker.getTracked()).toBeUndefined(); // context should be empty initially

  let requestPayload = event.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });

  // starting a request creates a context
  let context = tracker.getTracked();
  expect(context).not.toBeUndefined();

  // the stack consists solely of the request's event
  expect(context.stack).toEqual([requestPayload]);
  // and it should have these properties
  expect(requestPayload[schema.EVENT_TYPE]).toBe("source");
  let traceId = requestPayload[schema.TRACE_ID];
  expect(traceId).not.toBeUndefined();
  let startTime = requestPayload.startTime;
  expect(startTime).not.toBeUndefined();

  // libhoney shouldn't have been told to send anything yet
  expect(honey.transmission.events).toEqual([]);

  // finish the request
  event.finishTrace(requestPayload);
  expect(tracker.getTracked()).toBeUndefined(); // context should be cleared

  // libhoney should have been told to send one event
  expect(honey.transmission.events.length).toBe(1);
  let sent = honey.transmission.events[0];
  let postData = JSON.parse(sent.postData);
  expect(sent.timestamp).toEqual(new Date(startTime));
  expect(sent.sampleRate).toBe(1);
  expect(postData[schema.EVENT_TYPE]).toBe("source");
  expect(postData[schema.TRACE_SPAN_NAME]).toBe("name");
  expect(postData[schema.TRACE_ID]).toBe(traceId);
  expect(postData[schema.TRACE_PARENT_ID]).toBeUndefined();
  expect(postData[schema.TRACE_SPAN_ID]).not.toBeUndefined();
  expect(postData[schema.DURATION_MS]).not.toBeUndefined();
});

test("sample rates are propagated", () => {
  event._resetForTesting();
  event.configure({
    impl: "libhoney-event",
    transmission: "mock",
    writeKey: "abc123",
    sampleRate: 10,
  });

  const honey = event._apiForTesting().honey;
  expect(tracker.getTracked()).toBeUndefined(); // context should be empty initially

  let sampled = false;
  while (!sampled) {
    let requestPayload = event.startTrace({
      [schema.EVENT_TYPE]: "source",
      [schema.TRACE_SPAN_NAME]: "name",
    });
    if (requestPayload === null) {
      continue;
    }
    sampled = true;

    // starting a request creates a context
    let context = tracker.getTracked();
    expect(context).not.toBeUndefined();

    // the stack consists solely of the request's event
    expect(context.stack).toEqual([requestPayload]);
    // and it should have these properties
    expect(requestPayload[schema.EVENT_TYPE]).toBe("source");
    let traceId = requestPayload[schema.TRACE_ID];
    expect(traceId).not.toBeUndefined();
    let startTime = requestPayload.startTime;
    expect(startTime).not.toBeUndefined();

    // libhoney shouldn't have been told to send anything yet
    expect(honey.transmission.events).toEqual([]);

    // finish the request
    event.finishTrace(requestPayload);
    expect(tracker.getTracked()).toBeUndefined(); // context should be cleared

    // libhoney should have been told to send one event
    expect(honey.transmission.events.length).toBe(1);
    let sent = honey.transmission.events[0];
    let postData = JSON.parse(sent.postData);
    expect(sent.timestamp).toEqual(new Date(startTime));
    expect(sent.sampleRate).toBe(10);
    expect(postData[schema.EVENT_TYPE]).toBe("source");
    expect(postData[schema.TRACE_SPAN_NAME]).toBe("name");
    expect(postData[schema.TRACE_ID]).toBe(traceId);
    expect(postData[schema.TRACE_PARENT_ID]).toBeUndefined();
    expect(postData[schema.TRACE_SPAN_ID]).not.toBeUndefined();
    expect(postData[schema.DURATION_MS]).not.toBeUndefined();
  }
});

test("ending events out of order isn't allowed", () => {
  let requestPayload = event.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });
  let context = tracker.getTracked();

  expect(context.stack).toEqual([requestPayload]);

  let event2Payload = event.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  let event3Payload = event.startSpan({
    [schema.EVENT_TYPE]: "source3",
    [schema.TRACE_SPAN_NAME]: "name3",
  });
  expect(context.stack).toEqual([requestPayload, event2Payload, event3Payload]);

  // if we end event2Payload from the stack, we should also remove event3Payload.
  event.finishSpan(event2Payload);
  expect(context.stack).toEqual([requestPayload]);

  // if we finish event3 now, nothing should happen to the stack
  event.finishSpan(event3Payload);
  expect(context.stack).toEqual([requestPayload]);
});

test("sub-events can opt to rollup count/duration into request events", () => {
  let requestPayload = event.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });

  let eventPayload = event.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  event.finishSpan(eventPayload, "rollup");

  let durationMS = eventPayload[schema.DURATION_MS];
  expect(requestPayload["totals.source2.rollup.count"]).toBe(1);
  expect(requestPayload["totals.source2.rollup.duration_ms"]).toBe(durationMS);

  // another event from the same source
  let event2Payload = event.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  event.finishSpan(event2Payload, "rollup");

  let duration2MS = event2Payload[schema.DURATION_MS];
  expect(requestPayload["totals.source2.rollup.count"]).toBe(2);
  expect(requestPayload["totals.source2.rollup.duration_ms"]).toBe(durationMS + duration2MS);

  // these rollup to the instrumentation/source-level as well:
  expect(requestPayload["totals.source2.count"]).toBe(2);
  expect(requestPayload["totals.source2.duration_ms"]).toBe(durationMS + duration2MS);

  // one more event from the same source but a different name
  let event3Payload = event.startSpan({
    [schema.EVENT_TYPE]: "source2",
  });
  event.finishSpan(event3Payload, "rollup2");

  let duration3MS = event3Payload[schema.DURATION_MS];
  expect(requestPayload["totals.source2.rollup2.count"]).toBe(1);
  expect(requestPayload["totals.source2.rollup2.duration_ms"]).toBe(duration3MS);

  // it doesn't touch the "rollup" rollup
  expect(requestPayload["totals.source2.rollup.count"]).toBe(2);
  expect(requestPayload["totals.source2.rollup.duration_ms"]).toBe(durationMS + duration2MS);

  // but it does get rolled into the instrumentation/source-level rollup:
  expect(requestPayload["totals.source2.count"]).toBe(3);
  expect(requestPayload["totals.source2.duration_ms"]).toBe(durationMS + duration2MS + duration3MS);
});

test("sub-events will get manual tracing fields", () => {
  const honey = event._apiForTesting().honey;

  let requestPayload = event.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });

  let eventPayload = event.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  event.finishSpan(eventPayload);

  // finish the request
  event.finishTrace(requestPayload);

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
    const honey = event._apiForTesting().honey;

    let requestPayload = event.startTrace({
      [schema.EVENT_TYPE]: "source",
      [schema.TRACE_SPAN_NAME]: "name",
    });

    event.customContext.add("testKey", "testVal");

    // finish the request
    event.finishTrace(requestPayload);

    let requestData = JSON.parse(honey.transmission.events[0].postData);
    expect(requestData[schema.customContext("testKey")]).toBe("testVal");
  });

  test("removing it works too", () => {
    const honey = event._apiForTesting().honey;

    let requestPayload = event.startTrace({
      [schema.EVENT_TYPE]: "source",
      [schema.TRACE_SPAN_NAME]: "name",
    });

    event.customContext.add("testKey", "testVal");

    event.customContext.remove("testKey");

    // finish the request
    event.finishTrace(requestPayload);

    let requestData = JSON.parse(honey.transmission.events[0].postData);
    expect(requestData[schema.customContext("testKey")]).toBeUndefined();
  });

  test("it should be added to subevents sent after it was added", () => {
    const honey = event._apiForTesting().honey;

    let requestPayload = event.startTrace({
      [schema.EVENT_TYPE]: "source",
      [schema.TRACE_SPAN_NAME]: "name",
    });

    let eventPayload = event.startSpan({
      [schema.EVENT_TYPE]: "source2",
      [schema.TRACE_SPAN_NAME]: "name2",
    });
    event.finishSpan(eventPayload);

    event.customContext.add("testKey", "testVal");

    let eventPayload2 = event.startSpan({
      [schema.EVENT_TYPE]: "source3",
      [schema.TRACE_SPAN_NAME]: "name3",
    });
    event.finishSpan(eventPayload2);

    // finish the request
    event.finishTrace(requestPayload);

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

test("distributed tracing linkage is correct", () => {
  const honey = event._apiForTesting().honey;

  let rootSpan = event.startTrace({
    [schema.TRACE_SPAN_NAME]: "root",
  });
  let traceId = rootSpan[schema.TRACE_ID];

  let rootContext = tracker.getTracked();

  let marshaledContext = propagation.marshalTraceContext(rootContext);

  // this little bit of code simulates a downstream service.
  tracker.setTracked(undefined);
  let ctx = propagation.unmarshalTraceContext(marshaledContext);
  let subserviceRootSpan = event.startTrace(
    {
      [schema.TRACE_SPAN_NAME]: "sub",
    },
    ctx.traceId,
    ctx.parentSpanId
  );

  let subserviceSubspan = event.startSpan({
    [schema.TRACE_SPAN_NAME]: "subspan",
  });
  event.finishSpan(subserviceSubspan);
  event.finishTrace(subserviceRootSpan);
  // end of downstream service.

  // reinstate the root service's context and finish the trace there.
  tracker.setTracked(rootContext);
  event.finishTrace(rootSpan);

  // libhoney should have been told to send three events
  expect(honey.transmission.events.length).toBe(3);

  let subSpanEventData = JSON.parse(honey.transmission.events[0].postData);
  let subTraceEventData = JSON.parse(honey.transmission.events[1].postData);
  let rootEventData = JSON.parse(honey.transmission.events[2].postData);

  // make sure we grabbed the right events
  expect(subSpanEventData[schema.TRACE_SPAN_NAME]).toBe("subspan");
  expect(subTraceEventData[schema.TRACE_SPAN_NAME]).toBe("sub");
  expect(rootEventData[schema.TRACE_SPAN_NAME]).toBe("root");

  // make sure linkage is correct
  expect(subSpanEventData[schema.TRACE_ID]).toBe(traceId);
  expect(subTraceEventData[schema.TRACE_ID]).toBe(traceId);
  expect(rootEventData[schema.TRACE_ID]).toBe(traceId);

  expect(subSpanEventData[schema.TRACE_PARENT_ID]).toBe(subTraceEventData[schema.TRACE_SPAN_ID]);
  expect(subTraceEventData[schema.TRACE_PARENT_ID]).toBe(rootEventData[schema.TRACE_SPAN_ID]);
  expect(rootEventData[schema.TRACE_PARENT_ID]).toBeUndefined();

  // we should have 3 span ids
  let s = new Set();
  s.add(subSpanEventData[schema.TRACE_SPAN_ID]);
  s.add(subTraceEventData[schema.TRACE_SPAN_ID]);
  s.add(rootEventData[schema.TRACE_SPAN_ID]);
  expect(s.size).toBe(3);
});
