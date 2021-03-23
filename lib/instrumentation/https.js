/* eslint-env node */
const url = require("url"),
  shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  traceUtil = require("./trace-util");

let instrumentHTTPS = (https, opts = {}) => {
  shimmer.wrap(https, "get", function (_original) {
    // we have to replace http.get since it references request through
    // a closure (so we can't replace the value it uses..)
    return function (_url, _options, _cb) {
      let req = https.request.apply(this, Array.from(arguments));
      req.end();
      return req;
    };
  });

  shimmer.wrap(https, "request", function (original) {
    // node 10+ supports a three arg form.  Instead of writing both implementations,
    // dynamically switch on arg types.  I _hate_ code that does this, but it's easier
    // and cleaner than the alternative.
    //
    // The https.request function can be called either as:
    // https.request(options[, callback])
    // or
    // https.request(url[, options][, callback])
    // So we can have 1-3 args to work with. For more details, see:
    // https://nodejs.org/api/https.html#https_https_request_url_options_callback
    return function (/* Args are parsed using the local built-in variable "arguments" */) {
      if (!api.traceActive()) {
        return original.apply(this, Array.from(arguments));
      }

      let _url;
      let combinedOptions = {};
      let callback;

      if (arguments.length >= 3) {
        // We have _url, options, and callback if there are three args
        // If we have more, someone's doing something *weird* but account for it anyway
        _url = arguments[0];
        combinedOptions = arguments[1];
        callback = arguments[2];
      } else if (arguments.length === 2) {
        // With 2 arguments passed in, we can have the following combinations:
        // options, callback
        // _url, callback
        // _url, options

        // First, determine if we have a callback or not, which can only be the second arg
        if (typeof arguments[1] === "function") {
          callback = arguments[1];

          // Now that we know we have a callback, the first arg must be a url or options.
          // Check if the first arg is a string (a url) or an object (options, which can confusingly be a URL object too)
          if (typeof arguments[0] === "string") {
            // Case _url, callback
            _url = arguments[0];
          } else {
            // Case options, callback
            // This could techincally be either a plain object or a URL object
            combinedOptions = arguments[0];
          }
        } else {
          // Since we don't have a callback, the first arg must be a url, the second options
          _url = arguments[0];
          combinedOptions = arguments[1];
        }
      } else if (arguments.length === 1) {
        // Only one arg, so it's either a url or options. We have no callback.
        // Use the same check as above to determine which
        // If we have a string, it's a url, otherwise it's options.
        // Check if the first arg is a string (a url) or a plain object/URL object (options)
        if (typeof arguments[0] === "string") {
          _url = arguments[0];
        } else {
          // This could techincally be either a plain object or a URL object
          combinedOptions = arguments[0];
        }
      }

      // Build a url we can send with the async span call, either from _url or from the options
      const asyncSpanURL = _url ? new URL(_url) : new URL(combinedOptions);

      return api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "https",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: combinedOptions.method || "GET", // TODO work on this
          url: url.format(asyncSpanURL, {auth: false}), // auth:false makes sure we don't leak user/pass
        },
        (span) => {
          // in node 8.x, https calls into http.  currently we don't have a way
          // to communicate between instrumentations (ideally https would somehow
          // tell http that it shouldn't create the span), so this creates an additional
          // async span for the http call. the problem is that our wrapped_cb will be
          // called with the http context active, not ours.  so we have to bind our
          // callback here.
          let wrapped_cb = tracker.bindFunction(function (res) {
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

          // Build up a list of the arguments we were passed in to pass through to the https.request
          const returnArgs = [];
          if (_url) {
            returnArgs.push(_url);
          }

          // shallow clone options.headers, adding our tracing headers in
          // TODO - double check this works if we have a URL object here OR if combinedOptions isn't set
          combinedOptions.headers = Object.assign(
            {},
            combinedOptions.headers,
            traceUtil.propagateTraceHeader()
          );
          returnArgs.push(combinedOptions);

          if (callback) {
            returnArgs.push(wrapped_cb);
            return original.apply(this, returnArgs);
          } else {
            // the user didn't specify a callback, add it as a "response" handler ourselves
            return original.apply(this, returnArgs).on("response", wrapped_cb);
          }
        }
      );
    };
  });

  return https;
};

module.exports = instrumentHTTPS;
