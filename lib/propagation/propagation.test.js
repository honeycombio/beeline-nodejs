/* global require describe test expect */
const propagation = require("."),
  schema = require("../schema"),
  Span = require("../api/span"),
  cases = require("jest-in-case");

const { honeycomb, otel } = propagation;
// this context structure is the same as what the libhoney event api implementation generate.
let testContext = {
  id: "abcdef123456",
  dataset: "testDataset",
  stack: [new Span({ [schema.TRACE_SPAN_ID]: "0102030405" })],
  traceContext: {
    userID: 1,
    errorMsg: "failed to sign on",
    toRetry: true,
  },
};

describe("marshaling", () => {
  test("version string prefix", () => {
    expect(
      propagation.marshalTraceContext(testContext).startsWith(`${honeycomb.VERSION};`)
    ).toBeTruthy();
  });
});

cases(
  "unmarshaling",
  opts => expect(propagation.unmarshalTraceContext(opts.contextStr)).toEqual(opts.value),
  [
    {
      name: "unsupported version",
      contextStr: "9999999;.....",
      value: undefined,
    },
    {
      name: "v1 trace_id + parent_id, missing context",
      contextStr: "1;trace_id=abcdef,parent_id=12345",
      value: {
        traceId: "abcdef",
        parentSpanId: "12345",
      },
    },
    {
      name: "v1, missing trace_id",
      contextStr: "1;parent_id=12345",
      value: undefined,
    },
    {
      name: "v1, missing parent_id",
      contextStr: "1;trace_id=12345",
      value: undefined,
    },
    {
      name: "v1, garbled context",
      contextStr: "1;trace_id=abcdef,parent_id=12345,context=123~!@@&^@",
      value: undefined,
    },
    {
      name: "v1, unknown key (otherwise valid)",
      contextStr: "1;trace_id=abcdef,parent_id=12345,something=unsupported",
      value: {
        traceId: "abcdef",
        parentSpanId: "12345",
      },
    },
    {
      name: "v1, with context",
      contextStr: "1;trace_id=abcdef,parent_id=12345,context=eyJmb28iOiJiYXIifQo=",
      value: {
        traceId: "abcdef",
        parentSpanId: "12345",
        customContext: {
          foo: "bar",
        },
      },
    },
  ]
);

cases(
  "unmarshaling otel headers",
  opts => expect(otel.unmarshalTraceContext(opts.contextStr)).toEqual(opts.value),
  [
    {
      name: "unsupported version",
      contextStr: "99-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
      value: undefined,
    },
    {
      name: "v00, traceId, spanId, traceFlags=01",
      contextStr: "00-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
      value: {
        traceId: "7f042f75651d9782dcff93a45fa99be0",
        parentSpanId: "c998e73e5420f609",
        context: {
          traceFlags: 1,
        },
      },
    },
    {
      name: "v00, missing traceId",
      contextStr: "00-c998e73e5420f609-01",
      value: {
        traceId: "7f042f75651d9782dcff93a45fa99be0",
        parentSpanId: "c998e73e5420f609",
        context: {
          traceFlags: 1,
        },
      },
    },
    {
      name: "v1, missing trace_id",
      contextStr: "1;parent_id=12345",
      value: undefined,
    },
    {
      name: "v1, missing parent_id",
      contextStr: "1;trace_id=12345",
      value: undefined,
    },
    {
      name: "v1, garbled context",
      contextStr: "1;trace_id=abcdef,parent_id=12345,context=123~!@@&^@",
      value: undefined,
    },
    {
      name: "v1, unknown key (otherwise valid)",
      contextStr: "1;trace_id=abcdef,parent_id=12345,something=unsupported",
      value: {
        traceId: "abcdef",
        parentSpanId: "12345",
      },
    },
    {
      name: "v1, with context",
      contextStr: "1;trace_id=abcdef,parent_id=12345,context=eyJmb28iOiJiYXIifQo=",
      value: {
        traceId: "abcdef",
        parentSpanId: "12345",
        customContext: {
          foo: "bar",
        },
      },
    },
  ]
);

describe("roundtrip", () => {
  test("works", () => {
    let contextStr = propagation.marshalTraceContext(testContext);

    expect(propagation.unmarshalTraceContext(contextStr)).toEqual({
      traceId: "abcdef123456",
      parentSpanId: "0102030405",
      dataset: "testDataset",
      customContext: {
        userID: 1,
        errorMsg: "failed to sign on",
        toRetry: true,
      },
    });
  });
});
