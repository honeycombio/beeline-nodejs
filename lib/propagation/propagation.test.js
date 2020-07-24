/* global require describe test expect */
const propagation = require("."),
  schema = require("../schema"),
  Span = require("../api/span"),
  cases = require("jest-in-case");

const { honeycomb, w3c, aws } = propagation;
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

describe("marshaling aws", () => {
  test("version string prefix", () => {
    expect(aws.marshalTraceContext(testContext)).toEqual(
      "Root=1-abcdef123456;Parent=0102030405;userID=1;errorMsg=failed to sign on;toRetry=true"
    );
  });
});

cases(
  "unmarshaling aws",
  opts => expect(aws.unmarshalTraceContext(opts.contextStr)).toEqual(opts.value),
  [
    {
      name: "aws header with trace context",
      contextStr:
        "Root=1-abcdef123456;Parent=0102030405;userID=1;errorMsg=failed to sign on;toRetry=true",
      value: {
        traceId: "1-abcdef123456",
        parentSpanId: "0102030405",
        customContext: {
          userID: "1",
          errorMsg: "failed to sign on",
          toRetry: "true",
        },
      },
    },
    {
      name: "aws header with no trace context",
      contextStr: "Root=1-abcdef123456;Parent=0102030405",
      value: {
        traceId: "1-abcdef123456",
        parentSpanId: "0102030405",
      },
    },
    {
      name: "aws header missing root",
      contextStr: "Root=;Parent=0102030405",
      value: undefined,
    },
    {
      name: "aws header with no parent span id, no trace context",
      contextStr: "Root=1-abcdef123456",
      value: {
        traceId: "1-abcdef123456",
        parentSpanId: "1-abcdef123456",
      },
    },
  ]
);

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
  "marshaling w3c headers",
  opts => expect(w3c.marshalTraceContext(opts.context)).toEqual(opts.value),
  [
    {
      name: "v00, with parent, with span, with traceflags",
      context: {
        id: "7f042f75651d9782dcff93a45fa99be0",
        dataset: "testDataset",
        stack: [new Span({ [schema.TRACE_SPAN_ID]: "c998e73e5420f609" })],
        traceContext: {},
      },
      value: "00-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
    },
    {
      name: "honeycomb root",
      context: {
        id: "7f042f75651d9782dcff93a45fa99be0",
        dataset: "testDataset",
        stack: [new Span({ [schema.TRACE_SPAN_ID]: "c998e73e5420f609" })],
        traceContext: {},
      },
      // traceFlags should fallback to 01
      value: "00-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
    },
  ]
);

cases(
  "unmarshaling w3c headers",
  opts => expect(w3c.unmarshalTraceContext(opts.contextStr)).toEqual(opts.value),
  [
    {
      name: "v00, with parent, with span, with traceflags",
      contextStr: "00-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
      value: {
        parentSpanId: "c998e73e5420f609",
        traceId: "7f042f75651d9782dcff93a45fa99be0",
      },
    },
    {
      name: "unsupported version",
      contextStr: "99-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
      value: undefined,
    },
    {
      name: "invalid trace id",
      contextStr: "00-00000000000000000000000000000000-c998e73e5420f609-01",
      value: undefined,
    },
    {
      name: "invalid trace id, invalid span id",
      contextStr: "00-00000000000000000000000000000000-0000000000000000-01",
      value: undefined,
    },
    {
      name: "invalid span id",
      contextStr: "00-7f042f75651d9782dcff93a45fa99be0-0000000000000000-01",
      value: undefined,
    },
    {
      name: "v00, missing span id",
      contextStr: "00-7f042f75651d9782dcff93a45fa99be0-01",
      value: undefined,
    },
    {
      name: "v00, missing trace id",
      contextStr: "00-c998e73e5420f609-01",
      value: undefined,
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
