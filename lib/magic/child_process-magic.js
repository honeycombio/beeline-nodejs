/* global require, module */
const shimmer = require("shimmer"),
  tracker = require("../async_tracker"),
  event = require("../event");

function wrapExecLike(name) {
  return function(original) {
    return function(file, args /*, options, callback */) {
      let context = tracker.getTracked();
      if (!context) {
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
          event.addContext({ file });
          if (Array.isArray(args)) {
            event.addContext({ args });
          }
          event.finishEvent(ev, name);
          arg(error, stdout, stderr);
        };
      });

      ev = event.startEvent(context, "child_process");
      return original.apply(this, argsArray);
    };
  };
}

let instrumentChildProcess = child_process => {
  shimmer.wrap(child_process, "execFile", wrapExecLike("execFile"));

  return child_process;
};

module.exports = instrumentChildProcess;
