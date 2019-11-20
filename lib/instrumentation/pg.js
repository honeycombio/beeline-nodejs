/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema");

const getQueryString = function(args) {
  if (typeof args[0] === "string") return args[0];
  if (typeof args[0] === "object") return args[0].text;
  return undefined;
};

const getQueryArgs = function(args) {
  if (typeof args[0] === "object") return args[0].values;
  if (Array.isArray(args[1])) return args[1];
  return undefined;
};

const getQueryName = function(args) {
  if (typeof args[0] === "object") return args[0].name;
  return undefined;
};

const wrapper = (span, cb) => {
  return api.bindFunctionToTrace((...cb_args) => {
    let error = cb_args[0];
    let result = cb_args[1];

    if (error !== null && error instanceof Error) {
      api.addContext({
        "db.error": error.message,
        "db.error_stack": error.stack,
        "db.error_hint": error.hint,
      });
    }

    if (result) {
      api.addContext({
        "db.rows_affected": result.rowCount,
      });
    }

    api.finishSpan(span, "query");
    return cb(...cb_args);
  });
};

let instrumentPg = function(pg, opts = {}) {
  shimmer.wrap(pg.Client.prototype, "query", function(query) {
    return function(...args) {
      if (args.length < 1) {
        return query.apply(this, args);
      }
      if (!api.traceActive()) {
        return query.apply(this, args);
      }

      return api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "pg",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: "query",
          "db.query": getQueryString(args),
          "db.query_args": getQueryArgs(args),
          "db.query_name": getQueryName(args),
        },
        span => {
          let cb = args[args.length - 1];
          // XXX(toshok) this bindFunction shouldn't be necessary, but we aren't
          // finishing the event properly without it.
          let wrapped_cb = wrapper(span, cb);

          return query.apply(this, args.slice(0, -1).concat(wrapped_cb));
        }
      );
    };
  });
  return pg;
};

module.exports = instrumentPg;
