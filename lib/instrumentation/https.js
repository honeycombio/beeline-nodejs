/* eslint-env node */
const url = require("url"),
  shimmer = require("shimmer"),
  api = require("../api"),
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
      if (!api.traceActive()) {
        return original.apply(this, [options, cb]);
      }

      // let's make sure we have an object (or a url) for options.
      if (typeof options === "string") {
        options = url.parse(options); // node 10 doesn't use url.parse (except as a fallback).  figure out how to handle that?
      } else {
        // shallow-clone options since we'll be modifying it below (adding our header)
        options = Object.assign({}, options);
      }

      // another copy so we can normalize things
      let formatOptions = Object.assign({}, options);

      // make sure options is populated enough for url.format to give us reasonable results.  these are all defaults from nodejs docs.
      formatOptions.protocol = formatOptions.protocol || "https:";
      formatOptions.port = formatOptions.port !== 443 ? formatOptions.port : null;
      formatOptions.pathname = formatOptions.path || "/";
      if (!formatOptions.hostname && !formatOptions.host) {
        formatOptions.hostname = "localhost";
      }

      return api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "https",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: options.method || "GET",
          url: url.format(formatOptions),
        },
        span => {
          // in node 8.x, https calls into http.  currently we don't have a way
          // to communicate between instrumentations (ideally https would somehow
          // tell http that it shouldn't create the span), so this creates an additional
          // async span for the http call. the problem is that our wrapped_cb will be
          // called with the http context active, not ours.  so we have to bind our
          // callback here.
          let wrapped_cb = tracker.bindFunction(function(res) {
            api.finishSpan(span, "request");
            if (cb) {
              return cb.apply(this, [res]);
            }
          });

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
