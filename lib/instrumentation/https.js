/* eslint-env node */
const url = require("url"),
  shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema");

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
      if (!api.traceActive()) {
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

      return api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "https",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: options.method || "GET",
          url: url.format(options),
        },
        span => {
          let wrapped_cb = function(res) {
            api.finishSpan(span, "request");
            if (cb) {
              return cb.apply(this, [res]);
            }
          };

          // shallow clone options.headers, adding our tracing headers in
          options.headers = Object.assign({}, options.headers, {
            [api.TRACE_HTTP_HEADER]: api.marshalTraceContext(api.getTraceContext()),
          });

          if (cb) {
            return original.apply(this, [options, wrapped_cb]);
          } else {
            // the user didn't specify a callback, add it as a "response" handler ourselves
            return original.apply(this, [options]).on("response", wrapped_cb);
          }
        }
      );
    };
  });

  return https;
};

module.exports = instrumentHTTPS;
