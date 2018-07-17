/* global require, module */
const shimmer = require("shimmer"),
  event = require("../event"),
  schema = require("../schema");

function shimRenderMethod(reactDOMServer, name, packageVersion) {
  shimmer.wrap(reactDOMServer, name, function(original) {
    return function(...args) {
      if (!event.traceActive()) {
        return original.apply(this, args);
      }

      let ev = event.startEvent({
        [schema.EVENT_TYPE]: "react",
        [schema.PACKAGE_VERSION]: packageVersion,
        [schema.TRACE_SPAN_NAME]: name,
      });
      try {
        return original.apply(this, args);
      } finally {
        // do we want to include anything else?  the resulting string (might be huge)?
        event.finishEvent(ev, name);
      }
    };
  });
}

let instrumentReactDOMServer = function(ReactDOMServer, opts = {}) {
  shimRenderMethod(ReactDOMServer, "renderToString", opts.packageVersion);
  shimRenderMethod(ReactDOMServer, "renderToStaticMarkup", opts.packageVersion);

  return ReactDOMServer;
};

module.exports = instrumentReactDOMServer;
