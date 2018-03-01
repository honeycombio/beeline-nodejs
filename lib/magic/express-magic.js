/* global require, module */
const onHeaders = require("on-headers"),
  event = require("../event");

const magicMiddleware = (req, res, next) => {
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

let instrumentExpress = function(express) {
  const wrapper = function() {
    const app = express();
    app.use(magicMiddleware);
    return app;
  };
  Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(express));
  // install a shimmer-like flag here so we can test if we actually instrumented the library in tests.
  wrapper.__wrapped = true;
  return wrapper;
};

module.exports = instrumentExpress;
