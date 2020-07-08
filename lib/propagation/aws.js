/* global module */
const AMAZON_TRACE_HTTP_HEADER = "X-Amzn-Trace-Id";

// parsers take a string trace header and return a context
function unmarshalTraceContext(header) {
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
  };
}

module.exports = {
  unmarshalTraceContext,
  AMAZON_TRACE_HTTP_HEADER,
};
