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

function getRequestWithHeaders(headers) {
  const req = new http.IncomingMessage();
  headers.forEach((h) => (req.headers[h.name.toLowerCase()] = h.value));
  return req;
}

describe("getTraceContext", () => {
  cases(
    "beeline trace header",
    (opts) => {
      expect(
        traceUtil.getTraceContext(
          undefined,
          getRequestWithHeader(api.honeycomb.TRACE_HTTP_HEADER, opts.headerVal)
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
  cases(
    "w3c trace header fallback",
    (opts) => {
      expect(
        traceUtil.getTraceContext(
          undefined,
          getRequestWithHeader(api.w3c.TRACE_HTTP_HEADER, opts.headerVal)
        )
      ).toEqual(opts.expectedContext);
    },
    [
      {
        name: "w3c trace_id + parent_id, missing context",
        headerVal: "00-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
        expectedContext: {
          traceId: "7f042f75651d9782dcff93a45fa99be0",
          parentSpanId: "c998e73e5420f609",
          customContext: undefined,
          dataset: undefined,
          source: "traceparent http header",
        },
      },
    ]
  );
  cases(
    "if both honeycomb and w3c, choose honeycomb",
    (opts) => {
      expect(
        traceUtil.getTraceContext(
          undefined,
          getRequestWithHeaders([
            {
              name: api.w3c.TRACE_HTTP_HEADER,
              value: opts.w3cHeaderVal,
            },
            {
              name: api.honeycomb.TRACE_HTTP_HEADER,
              value: opts.beelineHeaderVal,
            },
          ])
        )
      ).toEqual(opts.expectedContext);
    },
    [
      {
        name: "we got both honeycomb and w3c, this should not happen",
        w3cHeaderVal: "00-7f042f75651d9782dcff93a45fa99be0-c998e73e5420f609-01",
        beelineHeaderVal: "1;trace_id=abcdefbeelineahh,parent_id=12345",
        expectedContext: {
          traceId: "abcdefbeelineahh",
          parentSpanId: "12345",
          customContext: undefined,
          dataset: undefined,
          source: "X-Honeycomb-Trace http header",
        },
      },
    ]
  );
});
