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
    return function(_url, _options, _cb) {
      let req = https.request.apply(this, Array.from(arguments));
      req.end();
      return req;
    };
  });

  shimmer.wrap(https, "request", function(original) {
    // node 10+ supports a three arg form.  Instead of writing both implementations,
    // dynamically switch on arg types.  I _hate_ code that does this, but it's easier
    // and cleaner than the alternative.
    return function(_url, options, cb) {
      if (!api.traceActive()) {
        return original.apply(this, Array.from(arguments));
      }

      let combinedOptions = {};
      let callback;

      if (typeof _url === "string") {
        combinedOptions = Object.assign({}, url.parse(_url)); // node 10 doesn't use url.parse (except as a fallback).  figure out how to handle that?
        delete combinedOptions.href;
        if (typeof options === "object") {
          Object.assign(combinedOptions, options);
          // we need to fix up `host` after this (if it wasn't specified in options), since the port might have changed.
          if (!options.host) {
            combinedOptions.host = `${combinedOptions.hostname}:${combinedOptions.port}`;
          }
          callback = cb;
        } else {
          callback = options;
        }
      } else if (typeof _url === "object") {
        // the two-arg form.
        combinedOptions = Object.assign({}, _url);
        callback = options;
      }

      // make sure options is populated enough for url.format to give us reasonable results.  these are all defaults from nodejs docs.
      combinedOptions.protocol = combinedOptions.protocol || "https:";
      combinedOptions.port = combinedOptions.port !== 443 ? combinedOptions.port : null;
      combinedOptions.pathname = combinedOptions.path || "/";
      if (!combinedOptions.hostname && !combinedOptions.host) {
        combinedOptions.hostname = "localhost";
      }

      return api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "https",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: combinedOptions.method || "GET",
          url: url.format(combinedOptions),
        },
        span => {
          // in node 8.x, https calls into http.  currently we don't have a way
          // to communicate between instrumentations (ideally https would somehow
          // tell http that it shouldn't create the span), so this creates an additional
          // async span for the http call. the problem is that our wrapped_cb will be
          // called with the http context active, not ours.  so we have to bind our
          // callback here.
          let wrapped_cb = tracker.bindFunction(function(res) {
            span.addContext({
              "response.http_version": res.httpVersion,
              "response.status_code": res.statusCode,
              "response.content_length": res.headers["content-length"],
              "response.content_type": res.headers["content-type"],
              "response.content_encoding": res.headers["content-encoding"],
            });
            api.finishSpan(span, "request");
            if (callback) {
              return callback.apply(this, [res]);
            }
          });

          // shallow clone options.headers, adding our tracing headers in
          combinedOptions.headers = Object.assign({}, combinedOptions.headers, {
            [api.TRACE_HTTP_HEADER]: api.marshalTraceContext(api.getTraceContext()),
          });

          if (callback) {
            return original.apply(this, [combinedOptions, wrapped_cb]);
          } else {
            // the user didn't specify a callback, add it as a "response" handler ourselves
            return original.apply(this, [combinedOptions]).on("response", wrapped_cb);
          }
        }
      );
    };
  });

  return https;
};

module.exports = instrumentHTTPS;
