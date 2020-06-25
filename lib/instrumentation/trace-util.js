/* eslint-env node */
const api = require("../api");
const { parseOtelTrace } = require("../propagation/w3c_context");

// returns the header name/value for the first header with a value in the request.
const getValueFromHeaders = (requestHeaders, headers) => {
  console.log(requestHeaders, headers);
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

function parseW3Trace(headers) {
  return parseOtelTrace(headers);
}

// refers to the parent trace
exports.getTraceContext = (traceIdSource, req) => {
  if (typeof traceIdSource === "undefined" || typeof traceIdSource === "string") {
    let headers =
      typeof traceIdSource === "undefined"
        ? [
            api.TRACE_HTTP_HEADER,
            "X-Request-ID",
            api.AMAZON_TRACE_HTTP_HEADER,
            api.OTEL_HTTP_HEADER,
          ]
        : [traceIdSource];
    let valueAndHeader = getValueFromHeaders(req.headers, headers);
    console.log({ headers: headers });
    console.log({ valueAndHeader });

    if (!valueAndHeader) {
      return {};
    }
    let { value, header } = valueAndHeader;

    switch (header) {
      //honeycomb trace header
      case api.TRACE_HTTP_HEADER: {
        let parsed = api.unmarshalTraceContext(value);
        if (!parsed) {
          return {};
        }
        return Object.assign({}, parsed, {
          source: `${header} http header`,
        });
      }

      case api.OTEL_HTTP_HEADER: {
        console.log(parseOtelTrace(value));
        return {};
      }

      case api.AMAZON_TRACE_HTTP_HEADER: {
        let traceId, parentSpanId;

        const split = value.split(";");
        for (const s of split) {
          const [name, value] = s.split("=");
          if (name === "Root") {
            traceId = value;
          } else if (name === "Parent") {
            parentSpanId = value;
          }
        }

        if (!traceId) {
          // if we didn't even get a 'Root=' clause, bail.
          return {};
        }

        if (!parentSpanId) {
          parentSpanId = traceId;
        }

        return {
          traceId,
          parentSpanId,
          source: `${header} http header`,
        };
      }

      default: {
        return {
          traceId: value,
          source: `${header} http header`,
        };
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
