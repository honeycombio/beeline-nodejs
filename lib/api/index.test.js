/* eslint-env node, jest */
const path = require("path"),
  api = require("."),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  propagation = require("../propagation"),
  deterministicSampler = require("../deterministic_sampler"),
  pkg = require(path.join(__dirname, "..", "..", "package.json"));

jest.mock("../deterministic_sampler");

beforeEach(() =>
  api.configure({ impl: "libhoney-event", transmission: "mock", writeKey: "abc123" })
);
afterEach(() => api._resetForTesting());
test("libhoney default config", () => {
  const honey = api._apiForTesting().honey;
  expect(honey.transmission.constructorArg.apiHost).toBe("https://api.honeycomb.io");
  expect(honey.transmission.constructorArg.dataset).toBe("nodejs");
  expect(honey.transmission.constructorArg.writeKey).toBe("abc123");
  expect(honey.transmission.constructorArg.userAgentAddition).toBe(
    `honeycomb-beeline/${pkg.version}`
  );
});

test("startTrace starts tracking and creates an initial event, finishTrace sends it", () => {
  const honey = api._apiForTesting().honey;
  expect(tracker.getTracked()).toBeUndefined(); // context should be empty initially

  let rootSpan = api.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });

  // starting a request creates a context
  let context = tracker.getTracked();
  expect(context).not.toBeUndefined();

  // the stack consists solely of the root span
  expect(context.stack).toEqual([rootSpan]);
  // and it should have these properties
  expect(rootSpan.payload[schema.EVENT_TYPE]).toBe("source");
  let traceId = rootSpan.payload[schema.TRACE_ID];
  expect(traceId).not.toBeUndefined();
  let startTime = rootSpan.startTime;
  expect(startTime).not.toBeUndefined();

  // libhoney shouldn't have been told to send anything yet
  expect(honey.transmission.events).toEqual([]);

  // finish the request
  api.finishTrace(rootSpan);
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
  api._resetForTesting();
  api.configure({
    impl: "libhoney-event",
    transmission: "mock",
    writeKey: "abc123",
    sampleRate: 10,
  });

  const honey = api._apiForTesting().honey;
  expect(tracker.getTracked()).toBeUndefined(); // context should be empty initially

  let rootSpan = api.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });

  // starting a request creates a context
  let context = tracker.getTracked();
  expect(context).not.toBeUndefined();

  // the stack consists solely of the request's event
  expect(context.stack).toEqual([rootSpan]);
  // and it should have these properties
  expect(rootSpan.payload[schema.EVENT_TYPE]).toBe("source");
  let traceId = rootSpan.payload[schema.TRACE_ID];
  expect(traceId).not.toBeUndefined();
  let startTime = rootSpan.startTime;
  expect(startTime).not.toBeUndefined();

  // libhoney shouldn't have been told to send anything yet
  expect(honey.transmission.events).toEqual([]);

  // finish the request
  api.finishTrace(rootSpan);
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
});

describe("sampler hook", () => {
  describe("if samplerHook option provided", () => {
    test("it enqueues event during finalSpan if shouldSample is true", () => {
      const mockSamplerHook = jest.fn(() => ({
        shouldSample: true,
        sampleRate: 123,
      }));
      api._resetForTesting();
      api.configure({
        impl: "libhoney-event",
        transmission: "mock",
        writeKey: "abc123",
        samplerHook: mockSamplerHook,
      });

      let eventPayload = api.startTrace({});

      expect(mockSamplerHook).toHaveBeenCalledTimes(0);

      api.finishTrace(eventPayload);

      expect(mockSamplerHook).toHaveBeenCalledTimes(1);
      expect(api._apiForTesting().honey.transmission.events).toHaveLength(1);
    });

    test("it does not enqueue event if shouldSample is false", () => {
      const mockSamplerHook = jest.fn(() => ({
        shouldSample: false,
        sampleRate: 123,
      }));
      api._resetForTesting();
      api.configure({
        impl: "libhoney-event",
        transmission: "mock",
        writeKey: "abc123",
        samplerHook: mockSamplerHook,
      });

      let eventPayload = api.startTrace({});
      api.finishTrace(eventPayload);

      expect(mockSamplerHook).toHaveBeenCalledTimes(1);
      expect(api._apiForTesting().honey.transmission.events).toHaveLength(0);
    });

    test("it does not enqueue event if invalid samplerHook provided", () => {
      const mockSamplerHook = jest.fn(() => ({
        foo: "bar",
        baz: false,
      }));
      api._resetForTesting();
      api.configure({
        impl: "libhoney-event",
        transmission: "mock",
        writeKey: "abc123",
        samplerHook: mockSamplerHook,
      });

      let eventPayload = api.startTrace({});
      api.finishTrace(eventPayload);

      expect(mockSamplerHook).toHaveBeenCalledTimes(1);
      expect(api._apiForTesting().honey.transmission.events).toHaveLength(0);
    });

    test("it falls back to deterministicSampler with sampleRate if non-function samplerHook provided", () => {
      deterministicSampler.mockReset();
      const mockSamplerHook = jest.fn(() => () => ({
        shouldSample: true,
        sampleRate: 999,
      }));
      deterministicSampler.mockImplementation(mockSamplerHook);
      api._resetForTesting();
      api.configure({
        impl: "libhoney-event",
        transmission: "mock",
        writeKey: "abc123",
        sampleRate: 12345,
        samplerHook: "I am invalid as I am not a function",
      });

      let eventPayload = api.startTrace({});
      api.finishTrace(eventPayload);

      expect(deterministicSampler).toHaveBeenCalledTimes(1);
      expect(deterministicSampler).toHaveBeenCalledWith(12345);
    });

    test("it updates the sampleRate of the event if shouldSample is true", () => {
      const mockSamplerHook = jest.fn(() => ({
        shouldSample: true,
        sampleRate: 999,
      }));
      api._resetForTesting();
      api.configure({
        impl: "libhoney-event",
        transmission: "mock",
        writeKey: "abc123",
        samplerHook: mockSamplerHook,
      });

      let eventPayload = api.startTrace({});
      api.finishTrace(eventPayload);

      expect(api._apiForTesting().honey.transmission.events[0].sampleRate).toEqual(999);
    });
  });

  describe("if no samplerHook given but valid sampleRate provided", () => {
    test("the default deterministicSampler hook initialised and used", () => {
      deterministicSampler.mockReset();
      const mockSamplerHook = jest.fn(() => () => ({
        shouldSample: true,
        sampleRate: 999,
      }));
      deterministicSampler.mockImplementation(mockSamplerHook);
      api._resetForTesting();
      api.configure({
        impl: "libhoney-event",
        transmission: "mock",
        writeKey: "abc123",
        sampleRate: 123,
      });

      let eventPayload = api.startTrace();

      // initialisation
      expect(deterministicSampler).toHaveBeenCalledTimes(1);
      expect(deterministicSampler).toHaveBeenCalledWith(123);

      api.finishTrace(eventPayload);

      // verify initiliser not called again
      expect(deterministicSampler).toHaveBeenCalledTimes(1);
      // verify actual sampler hook returned from intiialiser called
      expect(mockSamplerHook).toHaveBeenCalledTimes(1);
    });
  });

  describe("if neither a samplerHook nor sampleRate given", () => {
    test("send all events", () => {
      api._resetForTesting();
      api.configure({
        impl: "libhoney-event",
        transmission: "mock",
        writeKey: "abc123",
      });

      let eventPayload = api.startTrace({});
      api.finishTrace(eventPayload);

      expect(api._apiForTesting().honey.transmission.events).toHaveLength(1);
    });
  });
});

test("ending events out of order isn't allowed", () => {
  let rootSpan = api.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });
  let context = tracker.getTracked();

  expect(context.stack).toEqual([rootSpan]);

  let span2 = api.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  let span3 = api.startSpan({
    [schema.EVENT_TYPE]: "source3",
    [schema.TRACE_SPAN_NAME]: "name3",
  });
  expect(context.stack).toEqual([rootSpan, span2, span3]);

  // if we end span2 from the stack, we should also remove span3.
  api.finishSpan(span2);
  expect(context.stack).toEqual([rootSpan]);

  // if we finish span3 now, nothing should happen to the stack
  api.finishSpan(span3);
  expect(context.stack).toEqual([rootSpan]);
});

test("sub-events can opt to rollup count/duration into request events", () => {
  const honey = api._apiForTesting().honey;

  let rootSpan = api.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });

  let subSpan = api.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  api.finishSpan(subSpan, "rollup");

  let durationMS = JSON.parse(honey.transmission.events[0].postData)[schema.DURATION_MS];
  expect(rootSpan.payload["totals.source2.rollup.count"]).toBe(1);
  expect(rootSpan.payload["totals.source2.rollup.duration_ms"]).toBe(durationMS);

  // another span from the same source
  let span2 = api.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  api.finishSpan(span2, "rollup");

  let duration2MS = JSON.parse(honey.transmission.events[1].postData)[schema.DURATION_MS];
  expect(rootSpan.payload["totals.source2.rollup.count"]).toBe(2);
  expect(rootSpan.payload["totals.source2.rollup.duration_ms"]).toBe(durationMS + duration2MS);

  // these rollup to the instrumentation/source-level as well:
  expect(rootSpan.payload["totals.source2.count"]).toBe(2);
  expect(rootSpan.payload["totals.source2.duration_ms"]).toBe(durationMS + duration2MS);

  // one more event from the same source but a different name
  let span3 = api.startSpan({
    [schema.EVENT_TYPE]: "source2",
  });
  api.finishSpan(span3, "rollup2");

  let duration3MS = JSON.parse(honey.transmission.events[2].postData)[schema.DURATION_MS];
  expect(rootSpan.payload["totals.source2.rollup2.count"]).toBe(1);
  expect(rootSpan.payload["totals.source2.rollup2.duration_ms"]).toBe(duration3MS);

  // it doesn't touch the "rollup" rollup
  expect(rootSpan.payload["totals.source2.rollup.count"]).toBe(2);
  expect(rootSpan.payload["totals.source2.rollup.duration_ms"]).toBe(durationMS + duration2MS);

  // but it does get rolled into the instrumentation/source-level rollup:
  expect(rootSpan.payload["totals.source2.count"]).toBe(3);
  expect(rootSpan.payload["totals.source2.duration_ms"]).toBe(
    durationMS + duration2MS + duration3MS
  );
});

test("sub-events will get manual tracing fields", () => {
  const honey = api._apiForTesting().honey;

  let rootSpan = api.startTrace({
    [schema.EVENT_TYPE]: "source",
    [schema.TRACE_SPAN_NAME]: "name",
  });

  let subSpan = api.startSpan({
    [schema.EVENT_TYPE]: "source2",
    [schema.TRACE_SPAN_NAME]: "name2",
  });
  api.finishSpan(subSpan);
  api.finishTrace(rootSpan);

  // libhoney should have been told to send two events
  expect(honey.transmission.events.length).toBe(2);

  let subSpanData = JSON.parse(honey.transmission.events[0].postData);
  let rootSpanData = JSON.parse(honey.transmission.events[1].postData);

  expect(subSpanData[schema.TRACE_PARENT_ID]).toBe(rootSpanData[schema.TRACE_SPAN_ID]);
  expect(subSpanData[schema.TRACE_ID]).toBe(rootSpanData[schema.TRACE_ID]);
  expect(subSpanData[schema.TRACE_SPAN_NAME]).toBe("name2");
});

describe("custom context", () => {
  test("it should be added to request events", () => {
    const honey = api._apiForTesting().honey;

    let requestPayload = api.startTrace({
      [schema.EVENT_TYPE]: "source",
      [schema.TRACE_SPAN_NAME]: "name",
    });

    api.customContext.add("testKey", "testVal");

    // finish the request
    api.finishTrace(requestPayload);

    let requestData = JSON.parse(honey.transmission.events[0].postData);
    expect(requestData[schema.customContext("testKey")]).toBe("testVal");
  });

  test("removing it works too", () => {
    const honey = api._apiForTesting().honey;

    let requestPayload = api.startTrace({
      [schema.EVENT_TYPE]: "source",
      [schema.TRACE_SPAN_NAME]: "name",
    });

    api.customContext.add("testKey", "testVal");

    api.customContext.remove("testKey");

    // finish the request
    api.finishTrace(requestPayload);

    let requestData = JSON.parse(honey.transmission.events[0].postData);
    expect(requestData[schema.customContext("testKey")]).toBeUndefined();
  });

  test("it should be added to subevents sent after it was added", () => {
    const honey = api._apiForTesting().honey;

    let requestPayload = api.startTrace({
      [schema.EVENT_TYPE]: "source",
      [schema.TRACE_SPAN_NAME]: "name",
    });

    let eventPayload = api.startSpan({
      [schema.EVENT_TYPE]: "source2",
      [schema.TRACE_SPAN_NAME]: "name2",
    });
    api.finishSpan(eventPayload);

    api.customContext.add("testKey", "testVal");

    let eventPayload2 = api.startSpan({
      [schema.EVENT_TYPE]: "source3",
      [schema.TRACE_SPAN_NAME]: "name3",
    });
    api.finishSpan(eventPayload2);

    // finish the request
    api.finishTrace(requestPayload);

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
  const honey = api._apiForTesting().honey;

  let rootSpan = api.startTrace({
    [schema.TRACE_SPAN_NAME]: "root",
  });
  let traceId = rootSpan.payload[schema.TRACE_ID];

  // add some additional context to the root span
  rootSpan.addContext({ directContext: "direct" });
  api.addContext({ localContext: "local" });
  api.customContext.add({ customContext: "custom" });
  api.addTraceContext({ traceCustomContext: "trace-custom" });

  let rootContext = tracker.getTracked();

  let marshaledContext = propagation.marshalTraceContext(rootContext);

  // this little bit of code simulates a downstream service.
  tracker.setTracked(undefined);
  let ctx = propagation.unmarshalTraceContext(marshaledContext);
  let subserviceRootSpan = api.startTrace(
    {
      [schema.TRACE_SPAN_NAME]: "sub",
    },
    ctx.traceId,
    ctx.parentSpanId
  );
  const subContext = tracker.getTracked();
  subContext.traceContext = ctx.customContext;

  let subserviceSubspan = api.startSpan({
    [schema.TRACE_SPAN_NAME]: "subspan",
  });
  api.finishSpan(subserviceSubspan);
  api.finishTrace(subserviceRootSpan);
  // end of downstream service.

  // reinstate the root service's context and finish the trace there.
  tracker.setTracked(rootContext);
  api.finishTrace(rootSpan);

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

  // verify that context was/was not propagated
  expect(rootEventData["directContext"]).toBe("direct");
  expect(subSpanEventData["directContext"]).toBeUndefined();
  expect(subTraceEventData["directContext"]).toBeUndefined();

  expect(rootEventData["localContext"]).toBe("local");
  expect(subSpanEventData["localContext"]).toBeUndefined();
  expect(subTraceEventData["localContext"]).toBeUndefined();

  expect(rootEventData["app.customContext"]).toBe("custom");
  expect(subSpanEventData["app.customContext"]).toBe("custom");
  expect(subTraceEventData["app.customContext"]).toBe("custom");

  expect(rootEventData["app.traceCustomContext"]).toBe("trace-custom");
  expect(subSpanEventData["app.traceCustomContext"]).toBe("trace-custom");
  expect(subTraceEventData["app.traceCustomContext"]).toBe("trace-custom");
});

test("async spans share custom context", () => {
  const honey = api._apiForTesting().honey;

  let rootSpan = api.startTrace({
    [schema.TRACE_SPAN_NAME]: "root",
  });

  api.customContext.add("custom", "value");

  api.startAsyncSpan({}, span => {
    api.finishSpan(span);
  });
  api.finishTrace(rootSpan);

  expect(honey.transmission.events.length).toBe(2);

  let asyncData = JSON.parse(honey.transmission.events[0].postData);
  expect(asyncData["app.custom"]).toBe("value");
});

describe("presend hook", () => {
  it("calls the presend hook function if provided", () => {
    const mockPresendHook = jest.fn();
    api._resetForTesting();
    api.configure({
      impl: "libhoney-event",
      transmission: "mock",
      writeKey: "abc123",
      presendHook: mockPresendHook,
    });

    let eventPayload = api.startTrace({});

    api.finishTrace(eventPayload);

    expect(mockPresendHook).toHaveBeenCalledTimes(1);
    expect(api._apiForTesting().honey.transmission.events).toHaveLength(1);
  });

  it("doesn't call the presend hook if the event is not being sampled", () => {
    const mockPresendHook = jest.fn();
    const mockSamplerHook = jest.fn(() => ({ shouldSample: false, sampleRate: 1 }));
    api._resetForTesting();
    api.configure({
      impl: "libhoney-event",
      transmission: "mock",
      writeKey: "abc123",
      samplerHook: mockSamplerHook,
      presendHook: mockPresendHook,
    });

    let eventPayload = api.startTrace({});

    api.finishTrace(eventPayload);

    expect(mockSamplerHook).toHaveBeenCalledTimes(1);
    expect(mockPresendHook).toHaveBeenCalledTimes(0);
    expect(api._apiForTesting().honey.transmission.events).toHaveLength(0);
  });
});
