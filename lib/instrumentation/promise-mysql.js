/* eslint-env node */
const shimmer = require("shimmer");
const api = require("../api");
const schema = require("../schema");

function instrumentConnection(connection, packageVersion) {
  shimmer.wrap(connection, "query", function(original) {
    return function(...args) {
      if (!api.traceActive()) {
        return original.apply(this, args);
      }

      return api.startAsyncSpan(
        {
          [schema.EVENT_TYPE]: "mysql",
          [schema.PACKAGE_VERSION]: packageVersion,
          [schema.TRACE_SPAN_NAME]: "query",
          "db.query": args[0],
          "db.binds": args[1] || [],
        },
        span => {
          const returnValue = original.apply(this, args);

          returnValue
            .then(() => {
              api.finishSpan(span);
            })
            .catch(err => {
              if (err) {
                api.addContext({ error: err.toString() });
              }

              api.finishSpan(span);
            });

          return returnValue;
        }
      );
    };
  });

  return connection;
}

function instrumentPool(pool, packageVersion) {
  shimmer.wrap(pool, "getConnection", function(original) {
    return function(...args) {
      let connection = original.apply(this, args);

      connection.then(connection => {
        instrumentConnection(connection, packageVersion);
      });

      return connection;
    };
  });

  return pool;
}

function instrumentPromiseMysql(mysql, opts = {}) {
  shimmer.wrap(mysql, "createPool", function(original) {
    return function(...args) {
      let pool = original.apply(this, args);

      return instrumentPool(pool, opts.packageVersion);
    };
  });

  shimmer.wrap(mysql, "createConnection", function(original) {
    return function(...args) {
      let connection = original.apply(this, args);

      connection.then(connection => {
        instrumentConnection(connection, opts.packageVersion);
      });

      return connection;
    };
  });

  return mysql;
}

module.exports = instrumentPromiseMysql;
