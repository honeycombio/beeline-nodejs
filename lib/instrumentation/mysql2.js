/* eslint-env node */
const shimmer = require("shimmer"),
  tracker = require("../async_tracker"),
  event = require("../event"),
  schema = require("../schema");

let instrumentConnection = function(conn, packageVersion) {
  shimmer.wrap(conn, "execute", function(original) {
    return function(...args) {
      if (args.length < 1) {
        return original.apply(this, args);
      }
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, args);
      }

      // filled in below the callback
      let ev;

      let cb = args[args.length - 1];
      let wrapped_cb = function(...cb_args) {
        event.addContext({
          "db.query": args[0].sql,
        });
        event.finishEvent(ev, "query");
        return cb(...cb_args);
      };
      args = args.slice(0, -1).concat(wrapped_cb);

      ev = event.startEvent(context, "mysql2", "query");
      event.addContext({
        [schema.PACKAGE_VERSION]: packageVersion,
      });
      return original.apply(this, args);
    };
  });

  shimmer.wrap(conn, "query", function(original) {
    // this is the same as the execute shim.
    return function(...args) {
      if (args.length < 1) {
        return original.apply(this, args);
      }
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, args);
      }

      // filled in below the callback
      let ev;

      let cb = args[args.length - 1];
      // XXX(toshok) this bindFunction shouldn't be necessary, but we aren't
      // finishing the event properly without it.
      let wrapped_cb = tracker.bindFunction(function(...cb_args) {
        event.addContext({
          "db.query": args[0].sql,
        });
        event.finishEvent(ev, "query");
        return cb(...cb_args);
      });
      args = args.slice(0, -1).concat(wrapped_cb);

      ev = event.startEvent(context, "mysql2", "query");
      event.addContext({
        [schema.PACKAGE_VERSION]: packageVersion,
      });
      return original.apply(this, args);
    };
  });
  return conn;
};

let instrumentMysql2 = function(mysql2, opts = {}) {
  shimmer.wrap(mysql2, "createConnection", function(original) {
    return function(...args) {
      let conn = original.apply(this, args);
      return instrumentConnection(conn, opts.packageVersion);
    };
  });
  return mysql2;
};

module.exports = instrumentMysql2;
