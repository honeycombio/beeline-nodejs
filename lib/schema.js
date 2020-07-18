/* eslint-env node */

exports.EVENT_TYPE = "meta.type"; // XXX(toshok) rename "type" to "source"?
exports.NODE_VERSION = "meta.node_version";
exports.BEELINE_VERSION = "meta.beeline_version";
exports.PACKAGE = "meta.package";
exports.PACKAGE_VERSION = "meta.package_version";
exports.INSTRUMENTATIONS = "meta.instrumentations";
exports.INSTRUMENTATION_COUNT = "meta.instrumentation_count";
exports.HOSTNAME = "meta.local_hostname";
exports.DURATION_MS = "duration_ms";
exports.TRACE_ID = "trace.trace_id";
exports.TRACE_ID_SOURCE = "trace.trace_id_source";
exports.TRACE_PARENT_ID = "trace.parent_id";
exports.TRACE_SPAN_ID = "trace.span_id";
exports.TRACE_SERVICE_NAME = "service_name";
exports.TRACE_SPAN_NAME = "name";

// custom context fields will have this prefix
exports.customContext = key => `app.${key}`;
