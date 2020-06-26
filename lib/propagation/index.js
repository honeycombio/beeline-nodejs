/* global require, module */
module.exports = {
    honeycomb: require('./honeycomb'),
    otel: require('./w3c_context'),
    aws: require('./aws_xray')
};
