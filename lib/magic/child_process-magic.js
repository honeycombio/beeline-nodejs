/* global require, module */
const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

function wrapExecLike(name) {
  return function(original) {
    return function(file /* args, options, callback */) {
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
          // XXX(toshok) we need more event specific data here (command line for exec, file + args for execFile)
          event.addContext({ file });
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
