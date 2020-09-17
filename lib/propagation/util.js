/* eslint-env node */
const schema = require("../schema"),
  path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`);

exports.currentSpanId = currentSpanId;

// fetch current span id from the trace context passed as an argument
function currentSpanId(context) {
  return context.stack[context.stack.length - 1].payload[schema.TRACE_SPAN_ID];
}

exports.getPropagationContext = getPropagationContext;

// getPropagationContext accepts the current execution context
// and returns the standard trace propagation object
// containing the fields traceId, parentSpanId, dataset (optional), and customContext (optional)
// for use in propagation
function getPropagationContext(context = {}) {
  // standard propagation context fields and the path to its value
  return {
    traceId: context.id,
    parentSpanId: currentSpanId(context),
    dataset: context.dataset,
    customContext: context.traceContext,
  };
}

const configure = (function() {
  let customPropagationHooks = {};

  // pull propagation-related hooks from opts and store only those
  function setHooks(opts) {
    const { httpTraceParserHook, httpTracePropagationHook } = opts;
    customPropagationHooks = {
      httpTraceParserHook,
      httpTracePropagationHook,
    };
  }
  function getHooks() {
    return customPropagationHooks;
  }
  return {
    setHooks,
    getHooks,
  };
})();

// exported to run on require and module load with other configurations
exports.configure = configure.setHooks;

exports.parseFromRequest = parseFromRequest;

function parseFromRequest(req, parserHook = configure.getHooks().httpTraceParserHook) {
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

function headersFromContext(
  context,
  propagationHook = configure.getHooks().httpTracePropagationHook
) {
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
