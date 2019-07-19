/* eslint-env node */
const shimmer = require("shimmer"),
  tracker = require("../async_tracker"),
  schema = require("../schema"),
  api = require("../api"),
  traceUtil = require("./trace-util"),
  path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:fastify`);

const slice = Array.prototype.slice;

function isPromise(p) {
  return p && typeof p.then !== "undefined";
}

const instrumentFastify = function(fastify, opts = {}) {
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

  const trackedByRequest = new Map();
  const finishersByRequest = new Map();

  const wrapper = function(...args) {
    const app = fastify(...args);

    app.addHook("onRequest", (request, reply, next) => {
      // start our trace handling
      debug("in onRequest");

      let traceContext = traceUtil.getTraceContext(traceIdSource, request);
      let trace = api.startTrace(
        {
          [schema.EVENT_TYPE]: "fastify",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: "request",
          [schema.TRACE_ID_SOURCE]: traceContext.source,
          "request.host": request.hostname,
          "request.base_url": request.baseUrl,
          "request.original_url": request.originalUrl,
          "request.remote_addr": request.ip,
          "request.secure": request.secure,
          "request.method": request.method,
          "request.route": request.route ? request.route.path : undefined,
          "request.scheme": request.protocol,
          "request.path": request.path,
          "request.query": request.query,
          "request.http_version": `HTTP/${request.req.httpVersion}`,
          "request.fresh": request.fresh,
          "request.xhr": request.xhr,
        },
        traceContext.traceId,
        traceContext.parentSpanId,
        traceContext.dataset
      );

      if (traceContext.customContext) {
        api.addContext(traceContext.customContext);
      }

      if (!trace) {
        // sampler has decided that we shouldn't trace this request
        next();
        return;
      }

      const boundFinisher = api.bindFunctionToTrace(reply => {
        let userEventContext = traceUtil.getUserContext(userContext, request);
        if (userEventContext) {
          api.addContext(userEventContext);
        }

        api.addContext({
          "response.status_code": String(reply.res.statusCode),
        });
        if (request.params) {
          Object.keys(request.params).forEach(param =>
            api.addContext({
              [`request.param.${param}`]: request.params[param],
            })
          );
        }

        api.finishTrace(trace);
      });

      finishersByRequest.set(request, boundFinisher);
      trackedByRequest.set(request, tracker.getTracked());

      next();
    });

    app.addHook("onResponse", (request, reply, next) => {
      // calculate total time for the request and send the root span
      debug("in onResponse");

      const finisher = finishersByRequest.get(request);
      if (finisher) {
        debug("finishing");
        finisher(reply);
      }

      next();
    });

    // now that we've added our special hooks, instrument the addHook method such that
    shimmer.wrap(app, "addHook", function instrumentAddHook(original) {
      return function(hookName, hookFn) {
        if (hookName == "onResponse") {
          // we need to skip onResponse hooks, because we will have already ended the
          // trace.  we need a way to manipulate onResponse hooks
          return original.apply(this, [hookName, hookFn]);
        }

        let wrappedHook = function(...args) {
          let request = args[0];

          let tracked = trackedByRequest.get(request);
          tracker.setTracked(tracked);

          let span = api.startSpan({
            name: `${hookName} hook`,
            // XXX toshok more here
          });
          let next = args[args.length - 1];
          let wrappedNext;

          if (next && typeof next === "function") {
            wrappedNext = function() {
              api.finishSpan(span);
              return next();
            };
            args = slice.call(args, 0, -1).concat([wrappedNext]);
          }

          let rv = hookFn.apply(this, args);
          if (!isPromise(rv)) {
            // we don't end the span here - it should be ended with the call to next()
            return rv;
          }

          return new Promise((resolve, reject) => {
            rv.then(v => {
              tracker.setTracked(tracked);
              api.finishSpan(span);
              resolve(v);
            }).catch(e => {
              tracker.setTracked(tracked);
              api.finishSpan(span);
              reject(e);
            });
          });
        };

        return original.apply(this, [hookName, wrappedHook]);
      };
    });

    shimmer.wrap(app, "delete", function instrumentDelete(original) {
      return function(url, opts, handler) {
        // TODO wrap the handler
        return original.apply(this, [url, opts, handler]);
      };
    });

    shimmer.wrap(app, "get", function instrumentGet(original) {
      return function(url, opts, handler) {
        let fn = isPromise(opts) || typeof opts === "function" ? opts : handler;

        let wrappedHandler = function(request, reply) {
          let tracked = trackedByRequest.get(request);
          tracker.setTracked(tracked);

          let span = api.startSpan({
            name: `handler: GET ${url}`,
            // XXX toshok more here
          });

          let rv = fn.apply(this, [request, reply]);
          if (!isPromise(rv)) {
            api.finishSpan(span);
            return rv;
          }

          return new Promise((resolve, reject) => {
            rv.then(v => {
              tracker.setTracked(tracked);
              api.finishSpan(span);
              resolve(v);
            }).catch(e => {
              tracker.setTracked(tracked);
              api.finishSpan(span);
              reject(e);
            });
          });
        };
        return original.apply(this, slice.call(arguments, 0, -1).concat([wrappedHandler]));
      };
    });

    shimmer.wrap(app, "head", function instrumentHead(original) {
      return function(url, opts, handler) {
        // TODO wrap the handler
        return original.apply(this, [url, opts, handler]);
      };
    });

    shimmer.wrap(app, "patch", function instrumentPatch(original) {
      return function(url, opts, handler) {
        // TODO wrap the handler
        return original.apply(this, [url, opts, handler]);
      };
    });

    shimmer.wrap(app, "post", function instrumentPost(original) {
      return function(url, opts, handler) {
        // TODO wrap the handler
        return original.apply(this, [url, opts, handler]);
      };
    });

    shimmer.wrap(app, "put", function instrumentPut(original) {
      return function(url, opts, handler) {
        // TODO wrap the handler
        return original.apply(this, [url, opts, handler]);
      };
    });

    shimmer.wrap(app, "options", function instrumentOptions(original) {
      return function(url, opts, handler) {
        // TODO wrap the handler
        return original.apply(this, [url, opts, handler]);
      };
    });

    shimmer.wrap(app, "all", function instrumentAll(original) {
      return function(url, opts, handler) {
        // TODO wrap the handler
        return original.apply(this, [url, opts, handler]);
      };
    });

    return app;
  };

  Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(fastify));
  // install a shimmer-like flag here so we can test if we actually instrumented the library in tests.
  wrapper.__wrapped = true;
  return wrapper;
};

module.exports = instrumentFastify;
