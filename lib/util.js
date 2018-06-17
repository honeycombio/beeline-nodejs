/* eslint-env node */
exports.captureStackTrace = captureStackTrace;
function captureStackTrace(skipFrames = 0, limitFrames = 10) {
  let e = new Error();

  // save off what the current (perhaps app-specified) traceTraceLimit is so we can
  // capture limitFrames frames.
  let stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = stackTraceLimit < limitFrames ? limitFrames : stackTraceLimit;

  Error.captureStackTrace(e);

  // reinstate previous limit.
  Error.stackTraceLimit = stackTraceLimit;

  let frames = e.stack.split("\n");
  // the +1 here to get rid of the `Error\n` line at the top of the stacktrace.
  return frames.slice(1 + skipFrames).join("\n");
}
