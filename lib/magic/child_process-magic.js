/* global require, module */
const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

function wrapExecLike(name) {
  return function(original) {
    return function(_file /* args, options, callback */) {
      let tracked = tracker.getTracked();
      if (!tracked) {
        return original.apply(this, arguments);
      }

      let args = Array.from(arguments);
      let startTime;
      args.slice(1).forEach((arg, idx) => {
        if (typeof arg !== "function") {
          return;
        }
        args[idx + 1] = function(error, stdout, stderr) {
          let duration_ms = (Date.now() - startTime) / 1000;
          // XXX(toshok) we need more event specific data here (command line for exec, file + args for execFile)
          event.sendEvent(tracked, "child_process", startTime, name, { duration_ms });
          arg(error, stdout, stderr);
        };
      });

      startTime = Date.now();
      return original.apply(this, args);
    };
  };
}

let instrumentChildProcess = child_process => {
  shimmer.wrap(child_process, "execFile", wrapExecLike("execFile"));
  shimmer.wrap(child_process, "exec", wrapExecLike("exec"));

  return child_process;
};

module.exports = instrumentChildProcess;
