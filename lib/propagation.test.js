/* global require test expect */
const propagation = require("./propagation"),
  schema = require("./schema");

// this context structure is the same as what the libhoney event api implementation generate.
let testContext = {
  id: "abcdef123456",
  stack: [{ [schema.TRACE_SPAN_ID]: "0102030405" }],
  customContext: {
    userID: 1,
    errorMsg: "failed to sign on",
    toRetry: true,
  },
};

test("version string prefix", () => {
  expect(
    propagation.marshalTraceContext(testContext).startsWith(`${propagation.VERSION};`)
  ).toBeTruthy();
});

test("roundtrip", () => {
  let contextStr = propagation.marshalTraceContext(testContext);

  expect(propagation.unmarshalTraceContext(contextStr)).toEqual({
    traceId: "abcdef123456",
    spanId: "0102030405",
    customContext: {
      userID: 1,
      errorMsg: "failed to sign on",
      toRetry: true,
    },
  });
});
