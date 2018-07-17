/* global require, module */
const shimmer = require("shimmer"),
  event = require("../event"),
  schema = require("../schema");

function wrapExecLike(name, packageVersion) {
  return function(original) {
    return function(file, args /*, options, callback */) {
      if (!event.traceActive) {
        return original.apply(this, arguments);
      }

      // filled in below the callback
      let ev;

      let argsArray = Array.from(arguments);
      argsArray.slice(1).forEach((arg, idx) => {
        if (typeof arg !== "function") {
          return;
        }
        argsArray[idx + 1] = function(error, stdout, stderr) {
          event.addContext({ "exec.file": file });
          if (Array.isArray(args)) {
            event.addContext({ "exec.args": args });
          }
          event.finishEvent(ev, name);
          arg(error, stdout, stderr);
        };
      });

      ev = event.startEvent("child_process", name);
      event.addContext({
        [schema.PACKAGE_VERSION]: packageVersion,
      });
      return original.apply(this, argsArray);
    };
  };
}

let instrumentChildProcess = (child_process, opts = {}) => {
  shimmer.wrap(child_process, "execFile", wrapExecLike("execFile", opts.packageVersion));

  return child_process;
};

module.exports = instrumentChildProcess;
