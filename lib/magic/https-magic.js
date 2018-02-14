/* global require, module */
const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

let instrumentHTTPS = https => {
  shimmer.wrap(https, "get", function(_original) {
    // we have to replace http.get since it references request through
    // a closure (so we can't replace the value it uses..)
    return function(options, cb) {
      var req = https.request(options, cb);
      req.end();
      return req;
    };
  });

  shimmer.wrap(https, "request", function(original) {
    return function(options, cb) {
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, [options, cb]);
      }

      // filled in below the callback
      let ev;

      let wrapped_cb = function(res) {
        // XXX(toshok) add request url
        event.finishEvent(ev, "request");
        if (cb) {
          return cb.apply(this, [res]);
        }
      };

      ev = event.startEvent(context, "http");
      if (cb) {
        return original.apply(this, [options, wrapped_cb]);
      } else {
        // the user didn't specify a callback, add it as a "response" handler ourselves
        return original.apply(this, [options]).on("response", wrapped_cb);
      }
    };
  });

  return https;
};

module.exports = instrumentHTTPS;
