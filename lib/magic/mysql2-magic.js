const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

let instrumentConnection = function(conn) {
  shimmer.wrap(conn, "execute", function(original) {
    return function(...args) {
      if (args.length < 1) {
        return original.apply(this, args);
      }
      let mysqlPayload = tracker.getTracked("mysql");
      if (!mysqlPayload) {
        return original.apply(this, args);
      }
      let startTime;
      let cb = args[args.length - 1];
      let wrapped_cb = function(...cb_args) {
        incr(mysqlPayload, "execute_count");
        incr(mysqlPayload, "executeTime_ms", (Date.now() - startTime) / 1000);
        return cb(...cb_args);
      };
      args = args.slice(0, -1).concat(wrapped_cb);

      startTime = Date.now();
      return original.apply(this, args);
    };
  });

  shimmer.wrap(conn, "query", function(original) {
    // this is the same as the execute shim.
    return function(...args) {
      if (args.length < 1) {
        return original.apply(this, args);
      }
      let mysqlPayload = tracker.getTracked("mysql");
      if (!mysqlPayload) {
        return original.apply(this, args);
      }
      let startTime;
      let cb = args[args.length - 1];
      let wrapped_cb = function(...cb_args) {
        incr(mysqlPayload, "query_count");
        incr(mysqlPayload, "queryTime_ms", (Date.now() - startTime) / 1000);
        return cb(...cb_args);
      };
      args = args.slice(0, -1).concat(wrapped_cb);

      startTime = Date.now();
      return original.apply(this, args);
    };
  });
  return conn;
};

let instrumentMysql2 = function(mysql2) {
  shimmer.wrap(mysql2, "createConnection", function(original) {
    return function(...args) {
      let conn = original.apply(this, args);
      return instrumentConnection(conn);
    };
  });
  return mysql2;
};

module.exports = instrumentMysql2;
