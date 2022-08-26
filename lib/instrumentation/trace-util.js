/* eslint-env node */
const api = require("../api"),
  propagation = require("../propagation"),
  pkg = require("../../package.json"),
  debug = require("debug")(`${pkg.name}:event`);

// adds trace source field to the context and returns the updated context
function _includeSource(context, key) {
  if (!context) {
    return {};
  }
  return Object.assign({}, context, {
    source: `${key} http header`,
  });
}

// in the next major release, consolidate everything around hooks
exports.parseTraceHeader = (traceIdSource, req) => {
  if (propagation.hasCustomHttpParserHook()) {
    let parsed = propagation.parseFromRequest(req);
    return parsed ? parsed : {};
  }
  return exports.getTraceContext(traceIdSource, req);
};

exports.propagateTraceHeader = () => {
  const propagationContext = api.getPropagationContext();
  let serialized = propagation.headersFromContext(propagationContext);

  if (serialized) {
    return serialized;
  } else {
    return {
      [api.honeycomb.TRACE_HTTP_HEADER]: api.honeycomb.marshalTraceContext(api.getTraceContext()),
    };
  }
};

// parse a trace header and return object used to populate args to startTrace
// deprecated: in the next major release convert this to a default parser hook, and update usage logic
exports.getTraceContext = (traceIdSource, req) => {
  const { honeycomb, w3c, aws } = api;
  if (typeof traceIdSource === "undefined" || typeof traceIdSource === "string") {
    let header, value;

    if (typeof traceIdSource !== "undefined") {
      header = traceIdSource;
      value = req.headers[traceIdSource.toLowerCase()];
    } else {
      const honeycombHeaderValue = req.headers[honeycomb.TRACE_HTTP_HEADER.toLowerCase()];
      const w3cHeaderValue = req.headers[w3c.TRACE_HTTP_HEADER.toLowerCase()];

      if (honeycombHeaderValue && w3cHeaderValue) {
        debug("warn: received both honeycomb and w3c propagation headers, preferring honeycomb.");
      }

      if (honeycombHeaderValue) {
        header = honeycomb.TRACE_HTTP_HEADER;
        value = honeycombHeaderValue;
      } else if (w3cHeaderValue) {
        header = w3c.TRACE_HTTP_HEADER;
        value = w3cHeaderValue;
      }
    }

    if (!value) {
      // couldn't find trace context
      return {};
    }

    let parsed = {};
    switch (header) {
      //honeycomb trace header
      case honeycomb.TRACE_HTTP_HEADER: {
        header = honeycomb.TRACE_HTTP_HEADER;
        parsed = honeycomb.unmarshalTraceContext(value);
        return _includeSource(parsed, header);
      }

      case w3c.TRACE_HTTP_HEADER: {
        header = w3c.TRACE_HTTP_HEADER;
        parsed = w3c.unmarshalTraceContext(value);
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
