/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema");

let instrumentPg = function(pg, opts = {}) {
  shimmer.wrap(pg.Client.prototype, "query", function(query) {
    return function(...args) {
      if (args.length < 1) {
        return query.apply(this, args);
      }
      if (!api.traceActive()) {
        return query.apply(this, args);
      }

      let queryString = args[0].text;
      if (typeof queryString === "undefined") {
        queryString = args[0];
      }
      api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "pg",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: "query",
          "db.query": queryString,
          "db.query_args": args[1],
        },
        span => {
          let cb = args[args.length - 1];
          // XXX(toshok) this bindFunction shouldn't be necessary, but we aren't
          // finishing the event properly without it.
          let wrapped_cb = api.bindFunctionToTrace(function(...cb_args) {
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

          return query.apply(this, args.slice(0, -1).concat(wrapped_cb));
        }
      );
    };
  });
  return pg;
};

module.exports = instrumentPg;
