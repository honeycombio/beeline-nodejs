/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema");

let instrumentMysql2 = function(mysql2, opts = {}) {
  shimmer.massWrap(mysql2.Connection.prototype, ["execute", "query"], function(original) {
    return function(...args) {
      if (args.length < 1 || !api.traceActive()) {
        return original.apply(this, args);
      }

      let query = args[0].sql;
      if (typeof query === "undefined") {
        query = args[0];
      }
      return api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "mysql2",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: "query",
          "db.query": query,
        },
        span => {
          let callback = args[args.length - 1];
          // XXX(toshok) this bindFunction shouldn't be necessary, but we aren't
          // finishing the event properly without it.
          if (callback && typeof callback === "function") {
            let wrapped_callback = api.bindFunctionToTrace(function(...callback_args) {
              api.finishSpan(span, "query");
              return callback(...callback_args);
            });
            return original.apply(this, args.slice(0, -1).concat(wrapped_callback));
          }
          try {
            return original.apply(this, args);
          } finally {
            api.finishSpan(span, "query");
          }
        }
      );
    };
  });
  return mysql2;
};

module.exports = instrumentMysql2;
