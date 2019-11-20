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
          let [config, values, callback] = args;
          // we could be given the following:
          // query string, values, callback
          // query string, callback
          // Query object
          // Query object, callback
          if (typeof config.submit === "function") {
            // we have a 'Query' like object
            if (config.callback) {
              config.callback = wrapper(span, config.callback);
            } else if (typeof values === "function") {
              values = wrapper(span, values);
            }
          } else {
            if (typeof callback === "function") {
              callback = wrapper(span, callback);
            } else if (typeof values === "function") {
              values = wrapper(span, values);
            }
          }

          return query.apply(this, [config, values, callback]);
        }
      );
    };
  });
  return pg;
};

module.exports = instrumentPg;
