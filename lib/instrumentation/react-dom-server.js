/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema");

function shimRenderMethod(reactDOMServer, name, packageVersion) {
  shimmer.wrap(reactDOMServer, name, function(original) {
    return function(...args) {
      if (!api.traceActive()) {
        return original.apply(this, args);
      }

      return api.withSpan(
        {
          // do we want to include anything else?  the resulting string (might be huge)?
          [schema.EVENT_TYPE]: "react",
          [schema.PACKAGE_VERSION]: packageVersion,
          [schema.TRACE_SPAN_NAME]: name,
        },
        () => original.apply(this, args),
        name
      );
    };
  });
}

let instrumentReactDOMServer = function(ReactDOMServer, opts = {}) {
  shimRenderMethod(ReactDOMServer, "renderToString", opts.packageVersion);
  shimRenderMethod(ReactDOMServer, "renderToStaticMarkup", opts.packageVersion);

  return ReactDOMServer;
};

module.exports = instrumentReactDOMServer;
