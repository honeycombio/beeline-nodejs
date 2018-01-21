const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

let instrumentExpress = function(express) {
  let instrumented_express = function(...args) {
    let app = express(...args);

    shimmer.wrap(app, "handle", function(original) {
      return function(req, res, callback) {
        let eventPayload = {
          express: {
            hostname: req.hostname,
            url: req.url,
            secure: req.secure,
            method: req.method,
            route: req.route ? req.route.path : undefined,
            query: req.query,
            params: req.params,
            httpVersion: req.httpVersion,
            fresh: req.fresh,
            xhr: req.xhr,
            startTime: Date.now(),
          },
        };
        tracker.setTracked(eventPayload);

        return original.apply(this, [req, res, callback]);
      };
    });

    shimmer.wrap(app.response, "send", function(original) {
      return function(...args) {
        let rv = original.apply(this, args);

        let eventPayload = tracker.getTracked();
        if (!eventPayload) {
          return rv;
        }

        let expressPayload = eventPayload.express;

        // these don't reflect the actual state of the world after a request is sent to the user.  status codes can be modified by middleware,
        // as can encoding/length/actual bytes.  should we just always install a middleware at the root of the chain and do our event payload stuff
        // there (as well as reporting stats from the handler, perhaps)?
        expressPayload["handler_status_code"] = this.statusCode;
        expressPayload["handler_status_msg"] = this.statusMessage;
        expressPayload["handler_ms"] = (Date.now() - expressPayload["startTime"]) / 1000;
        delete expressPayload["startTime"];

        // otherwise they'll get notified of our POSTs...
        tracker.deleteTracked();

        event.send(eventPayload);
        return rv;
      };
    });
    return app;
  };

  // gross...
  for (let i of Object.keys(express)) {
    instrumented_express[i] = express[i];
  }

  return instrumented_express;
};

module.exports = instrumentExpress;
