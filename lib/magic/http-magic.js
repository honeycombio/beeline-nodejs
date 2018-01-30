const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

let instrumentHTTP = http => {
  shimmer.wrap(http, "get", function(original) {
    // we have to replace http.get since it references request through
    // a closure (so we can't replace the value it uses..)
    return function(options, cb) {
      var req = http.request(options, cb);
      req.end();
      return req;
    };
  });

  shimmer.wrap(http, "request", function(original) {
    return function(options, cb) {
      let tracked = tracker.getTracked();
      if (!tracked) {
        return original.apply(this, [options, cb]);
      }

      let startTime;
      let wrapped_cb = function(res) {
        let duration_ms = (Date.now() - startTime) / 1000;
        event.sendEvent(tracked, "http", startTime, "request", { duration_ms });
        if (cb) {
          return cb.apply(this, [res]);
        }
      };

      startTime = Date.now();
      if (cb) {
        return original.apply(this, [options, wrapped_cb]);
      } else {
        // the user didn't specify a callback, add it as a "response" handler ourselves
        return original.apply(this, [options]).on("response", wrapped_cb);
      }
    };
  });

  return http;
};

module.exports = instrumentHTTP;
