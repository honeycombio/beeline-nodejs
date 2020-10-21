/* eslint-env jest */
const { configure, parseFromRequest, headersFromContext } = require("./hooks");

describe("default hooks", () => {
  test("missing opts", () => {
    configure();
    expect(parseFromRequest({})).toBeUndefined();
    expect(headersFromContext({})).toBeUndefined();
  });

  test("empty opts", () => {
    configure({});
    expect(parseFromRequest({})).toBeUndefined();
    expect(headersFromContext({})).toBeUndefined();
  });
});

describe("parser hook", () => {
  test("valid fields", () => {
    function httpTraceParserHook(_req) {
      return {
        traceId: "12345",
        parentSpanId: "67890",
        dataset: "datasetGoesHere",
        customContext: { a: 1, b: 2 },
      };
    }

    configure({ httpTraceParserHook });

    expect(parseFromRequest({})).toEqual({
      traceId: "12345",
      parentSpanId: "67890",
      dataset: "datasetGoesHere",
      customContext: { a: 1, b: 2 },
    });
  });

  test("'invalid' fields are preserved in the return value", () => {
    function httpTraceParserHook(_req) {
      return {
        invalidTraceIdField: "12345",
        parentSpanId: "67890",
        dataset: "datasetGoesHere",
        customContext: { a: 1, b: 2 },
      };
    }
    configure({ httpTraceParserHook });

    expect(parseFromRequest({})).toEqual({
      invalidTraceIdField: "12345",
      parentSpanId: "67890",
      dataset: "datasetGoesHere",
      customContext: { a: 1, b: 2 },
    });
  });

  test("exception thrown in hook", () => {
    function httpTraceParserHook(_req) {
      throw new Error("hello!");
    }

    configure({ httpTraceParserHook });

    expect(parseFromRequest({})).toBeUndefined();
  });
});

describe("propagation hook", () => {
  test("returning falsey or non-object = undefined", () => {
    function httpTracePropagationHook(context) {
      return context;
    }

    configure({ httpTracePropagationHook });

    expect(headersFromContext(null)).toBeUndefined();
    expect(headersFromContext(false)).toBeUndefined();
    expect(headersFromContext("ahem")).toBeUndefined();
    expect(headersFromContext({ a: 1 })).toEqual({ a: 1 });

    // TODO(toshok) if we're going to have a rule about the return _type_,
    // these need to be fixed:
    //
    // expect(headersFromContext([])).toBeUndefined();
    // expect(headersFromContext(new Map())).toBeUndefined();
    // expect(headersFromContext(new Set())).toBeUndefined();
    // expect(headersFromContext(new ArrayBuffer())).toBeUndefined();
    // etc.
  });

  test("exception thrown in hook", () => {
    function httpTracePropagationHook(_context) {
      throw new Error("hello!");
    }

    configure({ httpTracePropagationHook });

    expect(headersFromContext({})).toBeUndefined();
  });
});
