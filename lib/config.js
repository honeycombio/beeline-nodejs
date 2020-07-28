/* eslint-env node */

exports.configOptions = [
  {
    name: "httpTraceParserHook",
    debugMsg:
      "httpTraceParserHook option must either be an string the hook to use or a function returning an object",
    allowedTypes: ["string", "function"],
  },
  {
    name: "httpTracePropagationHook",
    debugMsg:
      "httpTracePropagationHook option must either be an string the hook to use or a function returning an object",
    allowedTypes: ["string", "function"],
  },
  {
    name: "userContext",
    debugMsg:
      "userContext option must either be an array of field names or a function returning an object",
    allowedTypes: ["array", "function"],
  },
  {
    name: "traceIdSource",
    debugMsg:
      "traceIdSource option must either be an string (the http header name) or a function returning the string request id",
    allowedTypes: ["string", "function"],
  },
  {
    name: "parentIdSource",
    debugMsg:
      "parentIdSource option must either be an string (the http header name) or a function returning the string request id",
    allowedTypes: ["string", "function"],
  },
];
