/* global require, module */
const shimmer = require("shimmer"),
  methods = require("methods"),
  onHeaders = require("on-headers"),
  tracker = require("../async_tracker"),
  event = require("../event");

const magicMiddleware = (req, res, next) => {
  let startTime = Date.now();
  let eventPayload = event.newPayload();
  tracker.setTracked(eventPayload);

  onHeaders(res, function() {
    eventPayload = Object.assign(eventPayload, {
      ["app.hostname"]: req.hostname,
      ["app.baseUrl"]: req.baseUrl,
      ["app.url"]: req.url,
      ["app.originalUrl"]: req.originalUrl,
      ["app.ip"]: req.ip,
      ["app.secure"]: req.secure,
      ["app.method"]: req.method,
      ["app.route"]: req.route ? req.route.path : undefined,
      ["app.protocol"]: req.protocol,
      ["app.path"]: req.path,
      ["app.query"]: req.query,
      ["app.http_version"]: req.httpVersion,
      ["app.fresh"]: req.fresh,
      ["app.xhr"]: req.xhr,
      ["app.status_code"]: String(this.statusCode),
      ["app.response_time_ms"]: (Date.now() - startTime) / 1000,
    });
    Object.keys(req.params).forEach(param => {
      eventPayload[`app.param.${param}`] = req.params[param];
    });

    event.sendEvent(eventPayload, "app", startTime);
  });

  next();
};

let instrumentExpress = function(express) {
  shimmer.wrap(express.Route.prototype, "use", function(original) {
    return function(_fn) {
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
      return function(_fn) {
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
