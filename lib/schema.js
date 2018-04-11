/* global exports */

exports.EVENT_TYPE = "meta.type"; // XXX(toshok) rename "type" to "source"?
exports.REQUEST_ID = "meta.request_id";
exports.REQUEST_ID_SOURCE = "meta.request_id_source";
exports.INSTRUMENTATIONS = "meta.instrumentations";
exports.INSTRUMENTATION_COUNT = "meta.instrumentation_count";
exports.DURATION_MS = "durationMs";

exports.customContext = key => `custom.${key}`;
