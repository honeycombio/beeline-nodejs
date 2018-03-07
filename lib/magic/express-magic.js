/* global require, module */
const debug = require("debug")("honeycomb-magic:magic:express"),
  onHeaders = require("on-headers"),
  event = require("../event");

const getMagicMiddleware = userContext => (req, res, next) => {
  let ev = event.startRequest("express");

  event.addContext({
    ["express.hostname"]: req.hostname,
    ["express.baseUrl"]: req.baseUrl,
    ["express.url"]: req.url,
    ["express.originalUrl"]: req.originalUrl,
    ["express.ip"]: req.ip,
    ["express.secure"]: req.secure,
    ["express.method"]: req.method,
    ["express.route"]: req.route ? req.route.path : undefined,
    ["express.protocol"]: req.protocol,
    ["express.path"]: req.path,
    ["express.query"]: req.query,
    ["express.http_version"]: req.httpVersion,
    ["express.fresh"]: req.fresh,
    ["express.xhr"]: req.xhr,
  });

  onHeaders(res, function() {
    if (userContext) {
      // if we've got user data (from some other middleware), add it to the events
      let keys;
      let userObject;

      if (Array.isArray(userContext) && req.user) {
        keys = userContext;
        userObject = req.user;
      } else if (typeof userContext === "function") {
        userObject = userContext(req);
        keys = userObject && Object.keys(userObject);
      }

      if (userObject) {
        const userEventContext = {};

        for (const k of keys) {
          const v = userObject[k];
          if (typeof v !== "function") {
            userEventContext[`express.user.${k}`] = v;
          }
        }
        event.addContext(userEventContext);
      }
    }

    event.addContext({
      ["express.status_code"]: String(this.statusCode),
    });
    if (req.params) {
      Object.keys(req.params).forEach(param =>
        event.addContext({
          [`express.param.${param}`]: req.params[param],
        })
      );
    }

    event.finishRequest(ev, "express.response_time_ms");
  });

  next();
};

let instrumentExpress = function(express, opts) {
  let userContext;
  if (opts.userContext) {
    if (Array.isArray(opts.userContext) || typeof opts.userContext === "function") {
      userContext = opts.userContext;
    } else {
      debug(
        "userContext option must either be an array of field names or a function returning an object"
      );
    }
  }
  const wrapper = function() {
    const app = express();
    app.use(getMagicMiddleware(userContext));
    return app;
  };
  Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(express));
  // install a shimmer-like flag here so we can test if we actually instrumented the library in tests.
  wrapper.__wrapped = true;
  return wrapper;
};

module.exports = instrumentExpress;
