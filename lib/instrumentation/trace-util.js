/* eslint-env node */
const api = require("../api");

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

exports.getSpanContext = (traceIdSource, req) => {
  if (typeof traceIdSource === "undefined" || typeof traceIdSource === "string") {
    let headers =
      typeof traceIdSource === "undefined"
        ? [api.TRACE_HTTP_HEADER, "X-Request-ID", api.AMAZON_TRACE_HTTP_HEADER]
        : [traceIdSource];
    let valueAndHeader = getValueFromHeaders(req.headers, headers);

    if (!valueAndHeader) {
      return {};
    }
    let { value, header } = valueAndHeader;
    let parsed = {};

    switch (header) {
      //honeycomb trace header
      case api.honeycomb.TRACE_HTTP_HEADER: {
        header = api.honeycomb.TRACE_HTTP_HEADER;
        parsed = api.honeycomb.unmarshalTraceContext(value);
        return _includeSource(parsed, header);
      }

      case api.aws.TRACE_HTTP_HEADER: {
        header = api.aws.TRACE_HTTP_HEADER;
        parsed = api.aws.unmarshalTraceContext(value);
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

exports.addUnchangedContextField = map => {
  // fetch the active trace from the async hook
  const context = api.getTraceContext();

  if (!context) {
    // valid, since we can end up in our instrumentation outside of requests we're tracking
    return;
  }

  // add the fields to the currently active trace
  // in the async hook
  Object.assign(context.traceContext, map);
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
