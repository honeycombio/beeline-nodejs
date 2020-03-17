/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema");

function wrapExecLike(name, packageVersion) {
  return function(original) {
    return function(file, args /*, options, callback */) {
      if (!api.traceActive()) {
        return original.apply(this, arguments);
      }

      api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "child_process",
          [schema.PACKAGE_VERSION]: packageVersion,
          [schema.TRACE_SPAN_NAME]: name,
          "exec.file": file,
        },
        span => {
          if (Array.isArray(args)) {
            span.addContext({ "exec.args": args });
          }

          let argsArray = Array.from(arguments);
          argsArray.slice(1).forEach((arg, idx) => {
            if (typeof arg !== "function") {
              return;
            }
            argsArray[idx + 1] = function(error, stdout, stderr) {
              api.finishSpan(span, name);
              arg(error, stdout, stderr);
            };
          });
          return original.apply(this, argsArray);
        }
      );
    };
  };
}

let instrumentChildProcess = (child_process, opts = {}) => {
  shimmer.wrap(child_process, "execFile", wrapExecLike("execFile", opts.packageVersion));

  return child_process;
};

module.exports = instrumentChildProcess;
