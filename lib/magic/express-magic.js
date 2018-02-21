/* global require, module */
const onHeaders = require("on-headers"),
  event = require("../event");

const magicMiddleware = (req, res, next) => {
  let ev = event.startRequest("app");

  event.addContext({
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
  });

  onHeaders(res, function() {
    event.addContext({
      ["app.status_code"]: String(this.statusCode),
    });
    if (req.params) {
      Object.keys(req.params).forEach(param =>
        event.addContext({
          [`app.param.${param}`]: req.params[param],
        })
      );
      }

    event.finishRequest(ev, "app.response_time_ms");
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
