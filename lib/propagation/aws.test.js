/* eslint-env jest */
const propagation = require("."),
  schema = require("../schema"),
  Span = require("../api/span"),
  cases = require("jest-in-case");

const { aws } = propagation;

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

cases(
  "marshaling aws",
  (opts) => expect(aws.marshalTraceContext(opts.testContext)).toEqual(opts.header),
  [
    {
      name: "propagate span as Parent",
      testContext: {
        id: "abcdef123456",
        dataset: "testDataset",
        stack: [new Span({ [schema.TRACE_SPAN_ID]: "0102030405" })],
        traceContext: {
          userID: 1,
          errorMsg: "failed to sign on",
          toRetry: true,
        },
      },
      header:
        "Root=abcdef123456;Parent=0102030405;userID=1;errorMsg=failed to sign on;toRetry=true",
    },
    {
      name: "no trace id",
      testContext: {
        id: "",
        dataset: "testDataset",
        stack: [new Span({ [schema.TRACE_SPAN_ID]: "0102030405" })],
        traceContext: {
          userID: 1,
          errorMsg: "failed to sign on",
          toRetry: true,
        },
      },
      header: null,
    },
  ]
);

cases(
  "unmarshaling aws",
  (opts) => expect(aws.unmarshalTraceContext(opts.contextStr)).toEqual(opts.value),
  [
    {
      name: "aws header with trace context",
      contextStr:
        "Root=1-abcdef123456;Self=1-0102030405;userID=1;errorMsg=failed to sign on;toRetry=true",
      value: {
        traceId: "1-abcdef123456",
        parentSpanId: "1-0102030405",
        customContext: {
          userID: "1",
          errorMsg: "failed to sign on",
          toRetry: "true",
        },
      },
    },
    {
      name: "lowercase keys work, custom keys remain unchanged",
      contextStr:
        "root=abcdef123456;self=0102030405;userID=1;errorMsg=failed to sign on;toRetry=true",
      value: {
        traceId: "abcdef123456",
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
      contextStr: "Root=abcdef123456;Self=0102030405",
      value: {
        traceId: "abcdef123456",
        parentSpanId: "0102030405",
      },
    },
    {
      name: "root / parent / no self",
      contextStr: "Root=abcdef123456;Parent=37501823472",
      value: {
        traceId: "abcdef123456",
        parentSpanId: "37501823472",
      },
    },
    {
      name: "root / parent / self, use parent as parentSpanId",
      contextStr: "Root=abcdef123456;Parent=37501823472;Self=0102030405",
      value: {
        traceId: "abcdef123456",
        parentSpanId: "37501823472",
      },
    },
    {
      name: "aws header missing root",
      contextStr: "Root=;Self=0102030405",
      value: undefined,
    },
    {
      name: "aws header with no parent span id, no trace context",
      contextStr: "Root=abcdef123456",
      value: {
        traceId: "abcdef123456",
        parentSpanId: "abcdef123456",
      },
    },
    {
      name: "aws header with no parent span id, with trace context",
      contextStr: "Root=1-abcdef123456;userID=1;errorMsg=failed to sign on;toRetry=true",
      value: {
        traceId: "1-abcdef123456",
        parentSpanId: "1-abcdef123456",
        customContext: {
          userID: "1",
          errorMsg: "failed to sign on",
          toRetry: "true",
        },
      },
    },
    {
      name: "aws header with empty string parent",
      contextStr: "Root=1-abcdef123456;Parent=",
      value: {
        traceId: "1-abcdef123456",
        parentSpanId: "1-abcdef123456",
      },
    },
    {
      name: "aws header with empty string root",
      contextStr: "Root=;Self=0102030405",
      value: undefined,
    },
  ]
);

describe("roundtrip", () => {
  test("works", () => {
    let contextStr = aws.marshalTraceContext(testContext);
    expect(aws.unmarshalTraceContext(contextStr)).toEqual({
      traceId: "abcdef123456",
      parentSpanId: "0102030405",
      customContext: {
        userID: "1",
        errorMsg: "failed to sign on",
        toRetry: "true",
      },
    });
  });
});
