/* eslint-env node */
const onHeaders = require("on-headers"),
  shimmer = require("shimmer"),
  flatten = require("array-flatten"),
  tracker = require("../async_tracker"),
  schema = require("../schema"),
  api = require("../api"),
  util = require("../util"),
  path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:express`);

const slice = Array.prototype.slice;

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

const getTraceContext = (traceIdSource, req) => {
  if (typeof traceIdSource === "undefined" || typeof traceIdSource === "string") {
    let headers =
      typeof traceIdSource === "undefined"
        ? [api.TRACE_HTTP_HEADER, "X-Request-ID", "X-Amzn-Trace-Id"]
        : [traceIdSource];
    let valueAndHeader = getValueFromHeaders(req, headers);

    if (!valueAndHeader) {
      return {};
    }
    let { value, header } = valueAndHeader;

    switch (header) {
      case api.TRACE_HTTP_HEADER: {
        let parsed = api.unmarshalTraceContext(value);
        if (!parsed) {
          return {};
        }
        return Object.assign({}, parsed, {
          source: `${header} http header`,
        });
      }

      default: {
        return {
          traceId: value,
          source: `${header} http header`,
        };
      }
    }
  } else {
    return {
      traceId: traceIdSource(req),
      source: "traceIdSource function",
    };
  }
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
      userEventContext[`request.user.${k}`] = v;
    }
  }
  return userEventContext;
};

function wrapNextMiddleware(middleware, debugWrap) {
  let debugLocation;
  if (debugWrap) {
    debugLocation = util.captureStackTrace(5);
  }

  return function(req, res, next) {
    if (!api.traceActive()) {
      return middleware.apply(this, [req, res, next]);
    }

    let boundWrappedNext = api.bindFunctionToTrace(function(...args) {
      return next.apply(this, args);
    });

    let wrappedNext = boundWrappedNext;
    if (debugWrap) {
      wrappedNext = function(...args) {
        if (!api.traceActive()) {
          api._askForIssue(
            "we lost our tracking somewhere in the middleware registered:\n" + debugLocation,
            debug
          );
        }
        return boundWrappedNext.apply(this, args);
      };
    }

    return middleware.apply(this, [req, res, wrappedNext]);
  };
}

function wrapErrMiddleware(middleware, debugWrap) {
  let debugLocation;
  if (debugWrap) {
    debugLocation = util.captureStackTrace(5);
  }

  return function(err, req, res, next) {
    if (!api.traceActive()) {
      return middleware.apply(this, [err, req, res, next]);
    }

    let boundWrappedNext = api.bindFunctionToTrace(function(...args) {
      return next.apply(this, args);
    });

    let wrappedNext = boundWrappedNext;

    if (debugWrap) {
      wrappedNext = function(...args) {
        if (!api.traceActive()) {
          api._askForIssue(
            "we lost our tracking somewhere in the middleware registered:\n" + debugLocation,
            debug
          );
        }
        return boundWrappedNext.apply(this, args);
      };
    }

    return middleware.apply(this, [err, req, res, wrappedNext]);
  };
}

const getMagicMiddleware = ({ userContext, traceIdSource, packageVersion }) => (req, res, next) => {
  let traceContext = getTraceContext(traceIdSource, req);
  let trace = api.startTrace(
    {
      [schema.EVENT_TYPE]: "express",
      [schema.PACKAGE_VERSION]: packageVersion,
      [schema.TRACE_SPAN_NAME]: "request",
      [schema.TRACE_ID_SOURCE]: traceContext.source,
      "request.host": req.hostname,
      "request.base_url": req.baseUrl,
      "request.original_url": req.originalUrl,
      "request.remote_addr": req.ip,
      "request.secure": req.secure,
      "request.method": req.method,
      "request.route": req.route ? req.route.path : undefined,
      "request.scheme": req.protocol,
      "request.path": req.path,
      "request.query": req.query,
      "request.http_version": `HTTP/${req.httpVersion}`,
      "request.fresh": req.fresh,
      "request.xhr": req.xhr,
    },
    traceContext.traceId,
    traceContext.parentSpanId
  );

  if (traceContext.customContext) {
    Object.keys(traceContext.customContext).forEach(k =>
      api.customContext.add(k, traceContext.customContext[k])
    );
  }

  if (!trace) {
    // sampler has decided that we shouldn't trace this request
    next();
    return;
  }

  // we bind the method that finishes the request event so that we're guaranteed to get an event
  // regardless of any lapses in context propagation.  Doing it this way also allows us to _detect_
  // if there was a lapse, since `context` will be undefined in that case.
  let boundFinisher = api.bindFunctionToTrace((response, context) => {
    if (!context) {
      api._askForIssue("we lost our tracking somewhere in the stack handling this request", debug);
    }

    let userEventContext = getUserContext(userContext, req);
    if (userEventContext) {
      api.addContext(userEventContext);
    }

    api.addContext({
      "response.status_code": String(response.statusCode),
    });
    if (req.params) {
      Object.keys(req.params).forEach(param =>
        api.addContext({
          [`request.param.${param}`]: req.params[param],
        })
      );
    }

    api.finishTrace(trace);
  });

  onHeaders(res, function() {
    return boundFinisher(this, tracker.getTracked());
  });
  next();
};

let instrumentExpress = function(express, opts = {}) {
  let userContext, traceIdSource;

  if (opts.userContext) {
    if (Array.isArray(opts.userContext) || typeof opts.userContext === "function") {
      userContext = opts.userContext;
    } else {
      debug(
        "userContext option must either be an array of field names or a function returning an object"
      );
    }
  }

  if (opts.traceIdSource) {
    if (typeof opts.traceIdSource === "string" || typeof opts.traceIdSource === "function") {
      traceIdSource = opts.traceIdSource;
    } else {
      debug(
        "traceIdSource option must either be an string (the http header name) or a function returning the string request id"
      );
    }
  }

  let packageVersion = opts.packageVersion;

  let debugWrapMiddleware =
    typeof opts.debugWrapMiddleware !== "undefined" ? opts.debugWrapMiddleware : debug.enabled;
  const wrapper = function() {
    const app = express();
    // put our middleware in the chain at the start
    app.use(getMagicMiddleware({ userContext, traceIdSource, packageVersion }));

    // and wrap every other middleware's bind/error functions so we can 1) detect context loss, and 2) warn the user about it.
    shimmer.wrap(express.Router, "use", function instrumentUse(original) {
      return function(fn) {
        // copy the argument handling from express, with a couple of modifications:
        // 1. we don't care about the path here (we just need to locate/modify the functions)
        // 2. we wrap all middleware functions.

        // BEGIN_COPIED_FROM_EXPRESS
        var offset = 0;
        // express has this line, but we don't need it:
        // var path = "/";

        // default path to '/'
        // disambiguate app.use([fn])
        if (typeof fn !== "function") {
          var arg = fn;

          while (Array.isArray(arg) && arg.length !== 0) {
            arg = arg[0];
          }

          // first arg is the path
          if (typeof arg !== "function") {
            offset = 1;
            // express has this line, but we don't need it:
            // path = fn;
          }
        }

        // express has this line, but we need to wrap each of the values,
        // so add a .map call:
        //   var fns = flatten(slice.call(arguments, offset));
        let fns = flatten(slice.call(arguments, offset)).map(function(fn) {
          if (fn.length > 3) {
            // args are (err, req, res, next)
            return wrapErrMiddleware(fn, debugWrapMiddleware);
          }

          // args are (req, res, next)
          return wrapNextMiddleware(fn, debugWrapMiddleware);
        });

        if (fns.length === 0) {
          throw new TypeError("app.use() requires a middleware function");
        }
        // END_COPIED_FROM_EXPRESS

        return original.apply(this, slice.call(arguments, 0, offset).concat(fns));
      };
    });
    return app;
  };
  Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(express));
  // install a shimmer-like flag here so we can test if we actually instrumented the library in tests.
  wrapper.__wrapped = true;
  return wrapper;
};

module.exports = instrumentExpress;
