/* global require, module */
const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

let instrumentReactDOMServer = function(ReactDOMServer) {
  shimmer.wrap(ReactDOMServer, "renderToString", function(original) {
    return function(...args) {
      let tracked = tracker.getTracked();
      if (!tracked) {
        return original.apply(this, args);
      }

      let startTime = Date.now();
      let rv;
      try {
        rv = original.apply(this, args);
      } finally {
        // do we want to include anything else?  the resulting string (might be huge)?
        let duration_ms = (Date.now() - startTime) / 1000;
        event.sendEvent(tracked, "react", startTime, "renderToString", { duration_ms });
      }
      return rv;
    };
  });

  return ReactDOMServer;
};

module.exports = instrumentReactDOMServer;
