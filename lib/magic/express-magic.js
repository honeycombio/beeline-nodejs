/* global require, module */
const debug = require("debug")("honeycomb-magic:magic:express"),
  onHeaders = require("on-headers"),
  tracker = require("../async_tracker"),
  schema = require("../schema"),
  event = require("../event");

// returns the header name/value for the first header with a value in the request.
const getValueFromHeaders = (req, headers) => {
  let value, header;

  for (const h of headers) {
    let headerValue = req.get(h);
    if (headerValue) {
      header = h; // source = `${h} http header`;
      value = headerValue;
      break;
    }
  }

  if (typeof value !== "undefined") {
    return { value, header };
  }

  return undefined;
};

const getRequestId = (requestIdSource, req) => {
  let requestId, source;

  if (typeof requestIdSource === "undefined" || typeof requestIdSource === "string") {
    let headers =
      typeof requestIdSource === "undefined"
        ? ["X-Request-ID", "X-Amzn-Trace-Id"]
        : [requestIdSource];
    let headerAndValue = getValueFromHeaders(req, headers);

    if (headerAndValue) {
      requestId = headerAndValue.value;
      source = `${headerAndValue.header} http header`;
    }
  } else {
    requestId = requestIdSource(req);
    if (requestId) {
      source = "requestIdSource function";
    }
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
      userEventContext[`user.${k}`] = v;
    }
  }
  return userEventContext;
};

const getMagicMiddleware = ({ userContext, requestIdSource, packageVersion }) => (
  req,
  res,
  next
) => {
  let requestIdContext = getRequestId(requestIdSource, req);
  let ev = event.startRequest("express", requestIdContext.requestId);

  event.addContext({
    [schema.REQUEST_ID_SOURCE]: requestIdContext.source,
  });
  event.addContext({
    "meta.version": packageVersion,
  });

  event.addContext({
    hostname: req.hostname,
    baseUrl: req.baseUrl,
    url: req.url,
    originalUrl: req.originalUrl,
    ip: req.ip,
    secure: req.secure,
    method: req.method,
    route: req.route ? req.route.path : undefined,
    protocol: req.protocol,
    path: req.path,
    query: req.query,
    httpVersion: req.httpVersion,
    fresh: req.fresh,
    xhr: req.xhr,
  });

  // we bind the method that finishes the request event so that we're guaranteed to get an event
  // regardless of any lapses in context propagation.  Doing it this way also allows us to _detect_
  // if there was a lapse, since `context` will be undefined in that case.
  let boundFinisher = tracker.bindFunction((response, context) => {
    if (!context) {
      event.askForIssue("we lost our tracking somewhere in the stack handling this request", debug);
    }

    let userEventContext = getUserContext(userContext, req);
    if (userEventContext) {
      event.addContext(userEventContext);
    }

    event.addContext({
      statusCode: String(response.statusCode),
    });
    if (req.params) {
      Object.keys(req.params).forEach(param =>
        event.addContext({
          [`param.${param}`]: req.params[param],
        })
      );
    }

    event.finishRequest(ev);
  });

  onHeaders(res, function() {
    return boundFinisher(this, tracker.getTracked());
  });
  next();
};

let instrumentExpress = function(express, opts = {}) {
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

  let packageVersion = opts.packageVersion;

  const wrapper = function() {
    const app = express();
    app.use(getMagicMiddleware({ userContext, requestIdSource, packageVersion }));
    return app;
  };
  Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(express));
  // install a shimmer-like flag here so we can test if we actually instrumented the library in tests.
  wrapper.__wrapped = true;
  return wrapper;
};

module.exports = instrumentExpress;
