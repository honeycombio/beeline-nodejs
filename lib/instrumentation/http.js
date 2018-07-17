/* global require, module */
const url = require("url"),
  shimmer = require("shimmer"),
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
      if (!event.traceActive()) {
        return original.apply(this, [options, cb]);
      }

      let ev = event.startEvent({
        [schema.EVENT_TYPE]: "http",
        [schema.PACKAGE_VERSION]: opts.packageVersion,
        [schema.TRACE_SPAN_NAME]: "request",
        url: typeof options === "string" ? options : url.format(options),
      });

      let wrapped_cb = function(res) {
        event.finishEvent(ev, "request");
        if (cb) {
          return cb.apply(this, [res]);
        }
      };
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
