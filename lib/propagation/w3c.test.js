/* eslint-env jest */
const propagation = require("."),
  schema = require("../schema"),
  Span = require("../api/span"),
  cases = require("jest-in-case");

const { w3c } = propagation;

// this context structure is the same as what the libhoney event api implementation generate.
let testContext = {
  id: "7f042f75651d9782dcff93a45fa99be0",
  dataset: "testDataset",
  stack: [new Span({ [schema.TRACE_SPAN_ID]: "c998e73e5420f609" })],
};

cases(
  "marshaling w3c",
  (opts) => expect(w3c.marshalTraceContext(opts.testContext)).toEqual(opts.header),
  [
    {
      name: "don't propagate non-standard ids, no custom context",
      testContext: {
        id: "abcdef123456",
        dataset: "testDataset",
        stack: [new Span({ [schema.TRACE_SPAN_ID]: "0102030405" })],
      },
      header: "",
    },
    {
      name: "w3c-standard ids, custom context does not propagate in traceparent",
      testContext: {
        id: "7f042f75651d9782dcff93a45fa99be0",
        dataset: "testDataset",
        stack: [new Span({ [schema.TRACE_SPAN_ID]: "c998e73e5420f609" })],
        traceContext: {
          userID: 1,
          errorMsg: "failed to sign on",
          toRetry: true,
        },
      },
      header: "00-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
    },
  ]
);

cases(
  "unmarshaling w3c headers",
  (opts) => expect(w3c.unmarshalTraceContext(opts.contextStr)).toEqual(opts.value),
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
      value: {
        parentSpanId: "c998e73e5420f609",
        traceId: "7f042f75651d9782dcff93a45fa99be0",
      },
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
    let contextStr = w3c.marshalTraceContext(testContext);
    expect(w3c.unmarshalTraceContext(contextStr)).toEqual({
      traceId: "7f042f75651d9782dcff93a45fa99be0",
      parentSpanId: "c998e73e5420f609",
    });
  });
});
