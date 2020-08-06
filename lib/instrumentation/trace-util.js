/* eslint-env node */
const api = require("../api"),
  path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:propagation`);

// returns the header name/value for the first header with a value in the request.
const getValueFromHeaders = (requestHeaders, headers) => {
  let value, header;

  for (const h of headers) {
    let headerValue = requestHeaders[h.toLowerCase()];
    if (headerValue) {
      header = h; // source = `${h} http header`;
      value = headerValue;
      break;
    }
  }

  if (typeof value !== "undefined") {
    return { value, header };
  }

  return undefined;
};

// adds trace source field to the context and returns the updated context
function _includeSource(context, key) {
  if (!context) {
    return {};
  }
  return Object.assign({}, context, {
    source: `${key} http header`,
  });
}

exports.parseTraceHeader = (traceIdSource, req) => {
  // try to apply a custom parser hook first
  try {
    const customParsed = api.customParseTraceHeader(req);

    // if a custom parser hook returns something truthy but not an object
    // assume configuration error, user returned wrong type
    if (customParsed && typeof customParsed !== "object") {
      throw new Error("httpTraceParserHook must return an object");
    }

    if (customParsed) {
      return customParsed;
    }

    // use default parsing if no custom hook has been set
    // wrapping the existing parse function in this first iteration
    return exports.getTraceContext(traceIdSource, req);
  } catch (error) {
    debug(`unable to parse trace header: ${error}`);
    return {};
  }
};

exports.propagateTraceHeader = () => {
  const propagationContext = api.getPropagationContext();
  // try to apply a custom propagation hook first
  try {
    const customSerialized = api.customPropagateTraceHeader(propagationContext);

    // if a custom propagation hook returns something truthy but not an object
    // assume configuration error, user returned wrong type
    if (customSerialized && typeof customSerialized !== "object") {
      throw new Error(
        "httpTracePropagationHook must return an object containing trace headers as key/value pairs"
      );
    }
    // if it's truthy and an object, return the result of the custom hook
    else if (customSerialized) {
      return customSerialized;
    }
    // otherwise, default to honeycomb
    else {
      return {
        [api.honeycomb.TRACE_HTTP_HEADER]: api.honeycomb.marshalTraceContext(api.getTraceContext()),
      };
    }
  } catch (error) {
    debug(`unable to propagate trace: ${error}`);
    return {};
  }
};

// parse a trace header and return object used to populate args to startTrace
// deprecated: in the next major version this should get renamed to getSpanContext
exports.getTraceContext = (traceIdSource, req) => {
  const { honeycomb, aws } = api;
  if (typeof traceIdSource === "undefined" || typeof traceIdSource === "string") {
    let headers =
      typeof traceIdSource === "undefined"
        ? [honeycomb.TRACE_HTTP_HEADER, "X-Request-ID", aws.TRACE_HTTP_HEADER]
        : [traceIdSource];
    let valueAndHeader = getValueFromHeaders(req.headers, headers);

    if (!valueAndHeader) {
      return {};
    }
    let { value, header } = valueAndHeader;
    let parsed = {};
    switch (header) {
      //honeycomb trace header
      case honeycomb.TRACE_HTTP_HEADER: {
        header = honeycomb.TRACE_HTTP_HEADER;
        parsed = honeycomb.unmarshalTraceContext(value);
        return _includeSource(parsed, header);
      }

      case aws.TRACE_HTTP_HEADER: {
        header = aws.TRACE_HTTP_HEADER;
        parsed = aws.unmarshalTraceContext(value);
        return _includeSource(parsed, header);
      }

      default: {
        return _includeSource(
          {
            traceId: value,
          },
          header
        );
      }
    }
  } else {
    return {
      traceId: traceIdSource(req),
      source: "traceIdSource function",
    };
  }
};

exports.getParentSourceId = (parentIdSource, req) => {
  if (typeof parentIdSource === "string") {
    return req.headers[parentIdSource];
  } else if (typeof parentIdSource === "function") {
    return parentIdSource(req);
  }
};

exports.getUserContext = (userContext, req) => {
  if (!userContext) {
    return undefined;
  }

  // if we've got user data (from some other middleware), add it to the events
  let keys;
  let userObject;

  if (Array.isArray(userContext) && req.user) {
    keys = userContext;
    userObject = req.user;
  } else if (typeof userContext === "function") {
    userObject = userContext(req);
    keys = userObject && Object.keys(userObject);
  }

  if (!userObject) {
    return undefined;
  }

  const userEventContext = {};

  for (const k of keys) {
    const v = userObject[k];
    if (typeof v !== "function") {
      userEventContext[`request.user.${k}`] = v;
    }
  }
  return userEventContext;
};

exports.getInstrumentedRequestHeaders = () => {
  return {
    "X-Forwarded-For": "request.header.x_forwarded_for",
    "X-Forwarded-Proto": "request.header.x_forwarded_proto",
    "X-Forwarded-Port": "request.header.x_forwarded_port",
    "User-Agent": "request.header.user_agent",
    "Content-Type": "request.header.content_type",
    Accept: "request.header.accept",
  };
};
