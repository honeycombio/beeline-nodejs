const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

let instrumentReactDOMServer = function(ReactDOMServer) {
  shimmer.wrap(ReactDOMServer, "renderToString", function(original) {
    return function(...args) {
      let reactPayload = tracker.getTracked("react-dom");
      if (!reactPayload) {
        return original.apply(this, args);
      }

      let startTime = Date.now();
      let rv;
      try {
        rv = original.apply(this, args);
      } finally {
        incr(reactPayload, "renderToString_count");
        incr(reactPayload, "renderToString_ms", (Date.now() - startTime) / 1000);
      }
      return rv;
    };
  });

  return ReactDOMServer;
};

module.exports = instrumentReactDOMServer;
