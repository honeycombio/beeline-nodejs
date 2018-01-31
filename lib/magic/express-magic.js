const shimmer = require("shimmer"),
  methods = require("methods"),
  onHeaders = require("on-headers"),
  tracker = require("../async_tracker"),
  event = require("../event");

const magicMiddleware = (req, res, next) => {
  let startTime = Date.now();
  let eventPayload = {};
  tracker.setTracked(eventPayload);

  onHeaders(res, () => {
    eventPayload.express = {
      hostname: req.hostname,
      url: req.url,
      secure: req.secure,
      method: req.method,
      route: req.route ? req.route.path : undefined,
      query: req.query,
      params: req.params,
      httpVersion: req.httpVersion,
      fresh: req.fresh,
      xhr: req.xhr,
      status_code: res.statusCode,
      request_ms: (Date.now() - startTime) / 1000,
    };

    event.send(eventPayload);
  });

  next();
};

let instrumentExpress = function(express) {
  shimmer.wrap(express.Route.prototype, "use", function(original) {
    return function(fn) {
      if (this.stack.length === 0) {
        // insert our middleware
        original.apply(this, [magicMiddleware]);
      }

      return original.apply(this, arguments);
    };
  });

  // all the http methods supported need to be wrapped
  methods.concat("all").forEach(method =>
    shimmer.wrap(express.Route.prototype, method, function(original) {
      return function(fn) {
        if (this.stack.length === 0) {
          // insert our middleware
          original.apply(this, [magicMiddleware]);
        }

        return original.apply(this, arguments);
      };
    })
  );

  return express;
};

module.exports = instrumentExpress;
