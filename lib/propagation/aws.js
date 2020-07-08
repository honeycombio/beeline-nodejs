/* global exports */
const TRACE_HTTP_HEADER = "X-Amzn-Trace-Id";
exports.TRACE_HTTP_HEADER = TRACE_HTTP_HEADER;

// unmarshalTraceContext takes a string trace header and returns a context
exports.unmarshalTraceContext = unmarshalTraceContext;

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
    return;
  }

  if (!parentSpanId) {
    parentSpanId = traceId;
  }

  return {
    traceId,
    parentSpanId,
  };
}
