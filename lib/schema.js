/* global exports */

exports.EVENT_TYPE = "meta.type"; // XXX(toshok) rename "type" to "source"?
exports.BEELINE_VERSION = "meta.beeline_version";
exports.PACKAGE_VERSION = "meta.version";
exports.REQUEST_ID = "meta.request_id";
exports.REQUEST_ID_SOURCE = "meta.request_id_source";
exports.INSTRUMENTATIONS = "meta.instrumentations";
exports.INSTRUMENTATION_COUNT = "meta.instrumentation_count";
exports.HOSTNAME = "meta.local_hostname";
exports.DURATION_MS = "duration_ms";

exports.customContext = key => `custom.${key}`;
