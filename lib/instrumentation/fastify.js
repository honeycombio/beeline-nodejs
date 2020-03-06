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
  let userContext, traceIdSource, parentIdSource;
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

  if (opts.parentIdSource) {
    if (typeof opts.parentIdSource === "string" || typeof opts.traceIdSource === "function") {
      parentIdSource = opts.parentIdSource;
    } else {
      debug(
        "parentIdSource option must either be an string (the http header name) or a function returning the string request id"
      );
    }
  }

  const trackedByRequest = new Map();
  const finishersByRequest = new Map();

  // we only wrap the hooks that deal with requests.  we should look into wrapping the non request/reply hooks at
  // some point.
  const wrappedHookNames = [
    "onRequest",
    "preParsing",
    "preValidation",
    "preHandler",
    "preSerialization",
    "onError",
    "onSend",
    // TODO(toshok):
    // we need to skip onResponse hooks, because by the time this hook is invoked, we will have already ended the
    // trace.  There may be a way to instrument these (we'd need to end the trace after onResponse) - we should
    // figure it out.
    // "onResponse",
  ];

  const wrapper = function(...args) {
    const app = fastify(...args);

    app.addHook("onRequest", (request, reply, next) => {
      // start our trace handling
      let traceContext = traceUtil.getTraceContext(traceIdSource, request);
      let parentTraceId = traceUtil.getParentSourceId(parentIdSource, request);
      if (parentTraceId) {
        traceContext.parentSpanId = parentTraceId;
      }
      let rootSpan = api.startTrace(
        {
          [schema.EVENT_TYPE]: "fastify",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: "request",
          [schema.TRACE_ID_SOURCE]: traceContext.source,
          "request.host": request.hostname,
          "request.original_url": request.req.originalUrl,
          "request.remote_addr": request.ip,
          "request.method": request.req.method,
          "request.route": request.route ? request.route.path : undefined,
          "request.query": request.query,
          "request.http_version": `HTTP/${request.req.httpVersion}`,
        },
        traceContext.traceId,
        traceContext.parentSpanId,
        traceContext.dataset
      );

      if (traceContext.customContext) {
        api.addTraceContext(traceContext.customContext);
      }

      if (!rootSpan) {
        // sampler has decided that we shouldn't trace this request
        next();
        return;
      }

      const boundFinisher = api.bindFunctionToTrace(reply => {
        let userEventContext = traceUtil.getUserContext(userContext, request);
        if (userEventContext) {
          rootSpan.addContext(userEventContext);
        }

        rootSpan.addContext({
          "response.status_code": String(reply.res.statusCode),
        });
        if (request.params) {
          Object.keys(request.params).forEach(param =>
            rootSpan.addContext({
              [`request.param.${param}`]: request.params[param],
            })
          );
        }

        api.finishTrace(rootSpan);
      });

      finishersByRequest.set(request, boundFinisher);
      trackedByRequest.set(request, tracker.getTracked());

      next();
    });

    app.addHook("onResponse", (request, reply, next) => {
      // calculate total time for the request and send the root span
      const finisher = finishersByRequest.get(request);
      finishersByRequest.delete(request);
      trackedByRequest.delete(request);
      if (finisher) {
        finisher(reply);
      }

      next();
    });

    // now that we've added our special hooks, instrument the addHook method such that
    // others will show up as spans in the trace.
    shimmer.wrap(app, "addHook", function instrumentAddHook(original) {
      return function(hookName, hookFn) {
        if (wrappedHookNames.indexOf(hookName) === -1) {
          return original.apply(this, [hookName, hookFn]);
        }

        let wrappedHook = function(...args) {
          let request = args[0];

          let tracked = trackedByRequest.get(request);
          if (!tracked) {
            return hookFn.apply(this, args);
          }

          tracker.setTracked(tracked);

          let span = api.startSpan({
            name: `${hookName} hook`,
            [schema.EVENT_TYPE]: "fastify",
            [schema.PACKAGE_VERSION]: opts.packageVersion,
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

    function instrumentRoute(method, original) {
      return function(handlerUrl, handlerOpts, handlerFn) {
        let fn =
          isPromise(handlerOpts) || typeof handlerOpts === "function" ? handlerOpts : handlerFn;

        let wrappedHandler = function(request, reply) {
          let tracked = trackedByRequest.get(request);
          tracker.setTracked(tracked);

          let span = api.startSpan({
            name: `handler: ${method} ${handlerUrl}`,
            [schema.EVENT_TYPE]: "fastify",
            [schema.PACKAGE_VERSION]: opts.packageVersion,
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
    }

    shimmer.wrap(app, "delete", original => instrumentRoute("DELETE", original));
    shimmer.wrap(app, "get", original => instrumentRoute("GET", original));
    shimmer.wrap(app, "head", original => instrumentRoute("GET", original));
    shimmer.wrap(app, "patch", original => instrumentRoute("PATCH", original));
    shimmer.wrap(app, "post", original => instrumentRoute("POST", original));
    shimmer.wrap(app, "put", original => instrumentRoute("PUT", original));
    shimmer.wrap(app, "options", original => instrumentRoute("OPTIONS", original));
    shimmer.wrap(app, "all", original => instrumentRoute("ALL", original));

    return app;
  };

  Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(fastify));
  // install a shimmer-like flag here so we can test if we actually instrumented the library in tests.
  wrapper.__wrapped = true;
  return wrapper;
};

module.exports = instrumentFastify;
