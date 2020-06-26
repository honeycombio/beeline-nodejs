/* eslint-env node */
/* global require, module */

const path = require("path"),
    pkg = require(path.join(__dirname, "..", "..", "package.json")),
    debug = require("debug")(`${pkg.name}:event`);

function unmarshalTraceContext(version) {
    if (version !== "1") {
        debug(`unrecognized trace context version ${version}.  ignoring.`);
        return unmarshalTraceContextv1(payload);
    }
    return 
}

function unmarshalTraceContextv1(contextStr) {
    let parsed = api.unmarshalTraceContext(value);
    let [version, payload] = contextStr.trim().split(";");
    
    return;
}
  
module.exports = {
    unmarshalTraceContext,
    honeycomb: require('./honeycomb'),
    otel: require('./w3c_context'),
    aws: require('./aws_xray')
};
