/* global require, module */
const shimmer = require("shimmer"),
  tracker = require("../async_tracker"),
  event = require("../event");

function shimRenderMethod(reactDOMServer, name) {
  shimmer.wrap(reactDOMServer, name, function(original) {
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
        event.finishEvent(ev, name);
      }
      return rv;
    };
  });
}

let instrumentReactDOMServer = function(ReactDOMServer) {
  shimRenderMethod(ReactDOMServer, "renderToString");
  shimRenderMethod(ReactDOMServer, "renderToStaticMarkup");

  return ReactDOMServer;
};

module.exports = instrumentReactDOMServer;
