/* eslint-env node */
const url = require("url"),
  shimmer = require("shimmer"),
  event = require("../event_api"),
  propagation = require("../propagation"),
  schema = require("../schema"),
  tracker = require("../async_tracker");

let instrumentHTTPS = (https, opts = {}) => {
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
      if (!event.traceActive()) {
        return original.apply(this, [options, cb]);
      }

      // let's make sure we have an object (or a url) for options.
      if (typeof options === "string") {
        options = url.parse(options);
      } else {
        // shallow-clone options since we'll be modifying it below
        options = Object.assign({}, options);
      }

      // make sure options is populated enough for url.format to give us reasonable results.  these are all defaults from nodejs docs.
      options.protocol = options.protocol || "https:";
      options.port = options.port !== 443 ? options.port : null;
      options.pathname = options.path || "/";
      if (!options.hostname && !options.host) {
        options.hostname = "localhost";
      }

      let ev = event.startSpan({
        [schema.EVENT_TYPE]: "https",
        [schema.PACKAGE_VERSION]: opts.packageVersion,
        [schema.TRACE_SPAN_NAME]: options.method || "GET",
        url: url.format(options),
      });

      let wrapped_cb = function(res) {
        event.finishSpan(ev, "request");
        if (cb) {
          return cb.apply(this, [res]);
        }
      };

      // shallow clone options.headers, adding our tracing headers in
      options.headers = Object.assign({}, options.headers, {
        [propagation.TRACE_HTTP_HEADER]: propagation.marshalTraceContext(tracker.getTracked()),
      });

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
