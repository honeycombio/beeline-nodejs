const libhoney = require("libhoney").default,
  uuidv4 = require("uuid/v4"),
  uppercamelcase = require("uppercamelcase"),
  tracker = require("./async_tracker");

let honey;

const defaultName = "nodejs";

exports.configure = opts => {
  if (honey) {
    return;
  }

  honey = new libhoney(
    Object.assign(
      {
        apiHost: process.env["HONEYCOMB_API_HOST"] || "https://api.honeycomb.io",
        writeKey: process.env["HONEYCOMB_WRITEKEY"],
        dataset: process.env["HONEYCOMB_DATASET"] || defaultName,
        userAgentAddition: "honeycomb-nodejs events",
      },
      opts
    )
  );
};

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

exports.newPayload = () => ({
  request_id: uuidv4(),
});

exports.sendEvent = (eventPayload, type, startTime, appEventPrefix, type_payload) => {
  tracker.runWithoutTracking(() => {
    if (!appEventPrefix) {
      // this form is used by the "app" providers, like express.
      let ev = honey.newEvent();
      ev.timestamp = new Date(startTime);
      ev.add(eventPayload);
      ev.addField("type", type);
      ev.send();
      return;
    }

    incr(eventPayload, `app.total${uppercamelcase(type)}${uppercamelcase(appEventPrefix)}_count`);
    incr(
      eventPayload,
      `app.total${uppercamelcase(type)}${uppercamelcase(appEventPrefix)}Duration_ms`,
      type_payload.duration_ms
    );

    let ev = honey.newEvent();
    ev.timestamp = new Date(startTime);
    ev.add(type_payload);
    ev.add({
      type,
      // make sure we tag the sub-event with the proper app request_id
      request_id: eventPayload.request_id,
    });
    ev.send();
  });
};

exports.customContext = {
  add(key, val) {
    let eventPayload = tracker.getTracked();
    if (!eventPayload) {
      return;
    }

    eventPayload[`custom.${key}`] = val;
  },
};
