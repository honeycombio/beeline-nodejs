/* eslint-env node */
const shimmer = require("shimmer"),
  event = require("../event_api"),
  schema = require("../schema");

function shimRenderMethod(reactDOMServer, name, packageVersion) {
  shimmer.wrap(reactDOMServer, name, function(original) {
    return function(...args) {
      if (!event.traceActive()) {
        return original.apply(this, args);
      }

      let ev = event.startSpan({
        [schema.EVENT_TYPE]: "react",
        [schema.PACKAGE_VERSION]: packageVersion,
        [schema.TRACE_SPAN_NAME]: name,
      });
      try {
        return original.apply(this, args);
      } finally {
        // do we want to include anything else?  the resulting string (might be huge)?
        event.finishSpan(ev, name);
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
