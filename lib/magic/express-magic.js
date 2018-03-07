/* global require, module */
const debug = require("debug")("honeycomb-magic:magic:express"),
  onHeaders = require("on-headers"),
  event = require("../event");

const getRequestIdFromHeaders = (headers, req) => {
  let requestId, source;
  for (const h of headers) {
    requestId = req.get(h);
    if (requestId) {
      source = `${h} http header`;
      break;
    }
  }
  return { requestId, source };
};

const getRequestId = (requestIdSource, req) => {
  if (typeof requestIdSource === "undefined") {
    // grovel for a couple of locations for requestId
    return getRequestIdFromHeaders(["X-Request-ID", "X-Amzn-Trace-Id"], req);
  } else if (typeof requestIdSource === "string") {
    return getRequestIdFromHeaders([requestIdSource], req);
  }

  let requestId = requestIdSource(req);
  let source;
  if (requestId) {
    source = "requestIdSource function";
  }

  return { requestId, source };
};

const getUserContext = (userContext, req) => {
  if (!userContext) {
    return undefined;
  }

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

  if (!userObject) {
    return undefined;
  }

  const userEventContext = {};

  for (const k of keys) {
    const v = userObject[k];
    if (typeof v !== "function") {
      userEventContext[`express.user.${k}`] = v;
    }
  }
  return userEventContext;
};

const getMagicMiddleware = ({ userContext, requestIdSource }) => (req, res, next) => {
  let requestIdContext = getRequestId(requestIdSource, req);
  let ev = event.startRequest("express", requestIdContext.requestId);

  event.addContext({
    "meta.request_id_source": requestIdContext.source,
  });

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
    let userEventContext = getUserContext(userContext, req);
    if (userEventContext) {
      event.addContext(userEventContext);
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
  let userContext, requestIdSource;

  if (opts.userContext) {
    if (Array.isArray(opts.userContext) || typeof opts.userContext === "function") {
      userContext = opts.userContext;
    } else {
      debug(
        "userContext option must either be an array of field names or a function returning an object"
      );
    }
  }

  if (opts.requestIdSource) {
    if (typeof opts.requestIdSource === "string" || typeof opts.requestIdSource === "function") {
      requestIdSource = opts.requestIdSource;
    } else {
      debug(
        "requestIdSource option must either be an string (the http header name) or a function returning the string request id"
      );
    }
  }

  const wrapper = function() {
    const app = express();
    app.use(getMagicMiddleware({ userContext, requestIdSource }));
    return app;
  };
  Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(express));
  // install a shimmer-like flag here so we can test if we actually instrumented the library in tests.
  wrapper.__wrapped = true;
  return wrapper;
};

module.exports = instrumentExpress;
