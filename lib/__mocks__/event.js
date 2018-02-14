let sentEvents = [];

exports.sentEvents = sentEvents;
exports.sendEvent = (eventPayload, type, startTime, appEventPrefix, type_payload) => {
  sentEvents.push({ eventPayload, type, startTime, appEventPrefix, type_payload });
};
