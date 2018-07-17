/* eslint-env node */
const url = require("url"),
  shimmer = require("shimmer"),
  tracker = require("../async_tracker"),
  event = require("../event"),
  schema = require("../schema");

let instrumentHTTP = (http, opts = {}) => {
  shimmer.wrap(http, "get", function(_original) {
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
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, [options, cb]);
      }

      // filled in below the callback
      let ev;

      let wrapped_cb = function(res) {
        event.addContext({ url: typeof options === "string" ? options : url.format(options) });
        event.finishEvent(ev, "request");
        if (cb) {
          return cb.apply(this, [res]);
        }
      };

      ev = event.startEvent(context, "http", "request");
      event.addContext({
        [schema.PACKAGE_VERSION]: opts.packageVersion,
      });
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
