/* global require, module */
const onHeaders = require("on-headers"),
  event = require("../event");

const instrumentationKey = "express";

const magicMiddleware = (req, res, next) => {
  let ev = event.startRequest(instrumentationKey);

  event.addContext({
    [`${instrumentationKey}.hostname`]: req.hostname,
    [`${instrumentationKey}.baseUrl`]: req.baseUrl,
    [`${instrumentationKey}.url`]: req.url,
    [`${instrumentationKey}.originalUrl`]: req.originalUrl,
    [`${instrumentationKey}.ip`]: req.ip,
    [`${instrumentationKey}.secure`]: req.secure,
    [`${instrumentationKey}.method`]: req.method,
    [`${instrumentationKey}.route`]: req.route ? req.route.path : undefined,
    [`${instrumentationKey}.protocol`]: req.protocol,
    [`${instrumentationKey}.path`]: req.path,
    [`${instrumentationKey}.query`]: req.query,
    [`${instrumentationKey}.http_version`]: req.httpVersion,
    [`${instrumentationKey}.fresh`]: req.fresh,
    [`${instrumentationKey}.xhr`]: req.xhr,
  });

  onHeaders(res, function() {
    event.addContext({
      [`${instrumentationKey}.status_code`]: String(this.statusCode),
    });
    if (req.params) {
      Object.keys(req.params).forEach(param =>
        event.addContext({
          [`${instrumentationKey}.param.${param}`]: req.params[param],
        })
      );
    }

    event.finishRequest(ev, `${instrumentationKey}.response_time_ms`);
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
