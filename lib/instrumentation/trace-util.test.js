/* eslint-env node, jest */
const cases = require("jest-in-case"),
  http = require("http"),
  api = require("../api"),
  traceUtil = require("./trace-util");

function getRequestWithHeader(name, value) {
  const req = new http.IncomingMessage();
  req.headers[name.toLowerCase()] = value;
  return req;
}

describe("getTraceContext", () => {
  cases(
    "AWS X-Ray trace header",
    opts => {
      expect(
        traceUtil.getTraceContext(
          "X-Amzn-Trace-Id",
          getRequestWithHeader("X-Amzn-Trace-Id", opts.headerVal)
        )
      ).toEqual(opts.expectedContext);
    },
    [
      {
        name: "root / no parent",
        headerVal: "Root=1-67891233-abcdef012345678912345678",
        expectedContext: {
          traceId: "1-67891233-abcdef012345678912345678",
          parentSpanId: "1-67891233-abcdef012345678912345678",
          source: "X-Amzn-Trace-Id http header",
        },
      },
      {
        name: "root / parent",
        headerVal: "Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8",
        expectedContext: {
          traceId: "1-5759e988-bd862e3fe1be46a994272793",
          parentSpanId: "53995c3f42cd8ad8",
          source: "X-Amzn-Trace-Id http header",
        },
      },
      {
        name: "self / root / no parent",
        headerVal:
          "Self=1-5983f5c9-36d365bc453d28036a63032b;Root=1-5983f5c9-56dcf0bc6d4d214d2dbbe8c6",
        expectedContext: {
          parentSpanId: "1-5983f5c9-56dcf0bc6d4d214d2dbbe8c6",
          traceId: "1-5983f5c9-56dcf0bc6d4d214d2dbbe8c6",
          source: "X-Amzn-Trace-Id http header",
        },
      },
      {
        // shouldn't happen at least with aws generated headers, but if we're missing a Root= clause, we aren't in a trace at all.
        name: "no root / parent",
        headerVal: "Parent=53995c3f42cd8ad8",
        expectedContext: {},
      },
    ]
  );
  cases(
    "beeline trace header",
    opts => {
      expect(
        traceUtil.getTraceContext(
          undefined,
          getRequestWithHeader(api.TRACE_HTTP_HEADER, opts.headerVal)
        )
      ).toEqual(opts.expectedContext);
    },
    [
      {
        name: "v1 trace_id + parent_id, missing context",
        headerVal: "1;trace_id=abcdef,parent_id=12345",
        expectedContext: {
          traceId: "abcdef",
          parentSpanId: "12345",
          customContext: undefined,
          dataset: undefined,
          source: "X-Honeycomb-Trace http header",
        },
      },
      {
        name: "v1, missing trace_id",
        contextStr: "1;parent_id=12345",
        expectedContext: {},
      },
    ]
  );
});
