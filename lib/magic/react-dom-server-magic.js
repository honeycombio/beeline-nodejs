/* global require, module */
const tracker = require("../async_tracker"),
  shimmer = require("shimmer"),
  event = require("../event");

let instrumentReactDOMServer = function(ReactDOMServer) {
  shimmer.wrap(ReactDOMServer, "renderToString", function(original) {
    return function(...args) {
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, args);
      }

      let ev = event.startEvent(context, "react");
      let rv;
      try {
        rv = original.apply(this, args);
      } finally {
        // do we want to include anything else?  the resulting string (might be huge)?
        event.finishEvent(ev, "renderToString");
      }
      return rv;
    };
  });

  return ReactDOMServer;
};

module.exports = instrumentReactDOMServer;
