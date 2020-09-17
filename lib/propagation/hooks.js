/* eslint-env node */
const path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`);

let httpTraceParserHook;
let httpTracePropagationHook;

exports.configure = configure;

function configure(opts) {
  httpTraceParserHook = opts.httpTraceParserHook;
  httpTracePropagationHook = opts.httpTracePropagationHook;
}

exports.parseFromRequest = parseFromRequest;

function parseFromRequest(req, parserHook = httpTraceParserHook) {
  if (!parserHook) {
    // if no custom parser hook, bail to use defaults
    return;
  }

  try {
    const parsed = parserHook(req);

    if (!parsed) {
      // bail if no return from custom hook
      return;
    }

    // if a custom parser hook returns something truthy but not an object
    // assume configuration error, user returned wrong type
    if (typeof parsed !== "object") {
      debug("httpTraceParserHook must return an object");
      return;
    }

    // check for keys in the parser hook that are not usable
    const contextKeys = Object.keys(parsed);
    const allowedKeys = ["traceId", "parentSpanId", "dataset", "customContext"];
    const unsupportedKeys = contextKeys.filter(each => !allowedKeys.includes(each));

    if (unsupportedKeys.length > 0) {
      debug(`unsupported trace fields detected from parser hook: ${unsupportedKeys}`);
      debug(`expected keys: ${allowedKeys}`);
    }

    return parsed;
  } catch (error) {
    debug(`unable to apply httpTraceParserHook: ${error}`);
    return;
  }
}

exports.headersFromContext = headersFromContext;

function headersFromContext(context, propagationHook = httpTracePropagationHook) {
  if (!propagationHook) {
    // if no custom parser hook, bail to use defaults
    return;
  }
  try {
    const customSerialized = propagationHook(context);

    if (!customSerialized) {
      // bail if no return from custom hook
      return;
    }

    // if a custom propagation hook returns something truthy but not an object
    // assume configuration error, user returned wrong type
    if (customSerialized && typeof customSerialized !== "object") {
      debug(
        "httpTracePropagationHook must return an object containing trace headers as key/value pairs"
      );
      return;
    }

    return customSerialized;
  } catch (error) {
    debug(`unable to propagate trace: ${error}`);
    return;
  }
}
