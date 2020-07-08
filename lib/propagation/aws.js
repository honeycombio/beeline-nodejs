/* global module */
const AMAZON_TRACE_HTTP_HEADER = "X-Amzn-Trace-Id";

function parseAWSTraceHeader(header) {
  let traceId, parentSpanId;

  const split = header.split(";");
  for (const s of split) {
    const [name, value] = s.split("=");
    if (name === "Root") {
      traceId = value;
    } else if (name === "Parent") {
      parentSpanId = value;
    }
  }

  if (!traceId) {
    // if we didn't even get a 'Root=' clause, bail.
    return {};
  }

  if (!parentSpanId) {
    parentSpanId = traceId;
  }

  return {
    traceId,
    parentSpanId,
    source: `${header} http header`,
  };
}

module.exports = {
  parseAWSTraceHeader,
  AMAZON_TRACE_HTTP_HEADER,
};
