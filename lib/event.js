const libhoney = require("libhoney").default;

const tracker = require("./async_tracker");

let honey;

exports.configure = opts => {
  if (honey) {
    return;
  }
  honey = new libhoney(
    Object.assign(
      {
        apiHost: process.env["HONEYCOMB_API_HOST"],
        writeKey: process.env["HONEYCOMB_WRITEKEY"],
        dataset: process.env["HONEYCOMB_DATASET"],
        userAgentAddition: "honeycomb-nodejs events",
      },
      opts
    )
  );
};

exports.send = payload => {
  // flatten our instrumentation payloads
  let eventData = {};

  for (let k1 of Object.keys(payload)) {
    let instrumentationPayload = payload[k1];
    for (let k2 of Object.keys(instrumentationPayload)) {
      eventData[`${k1}/${k2}`] = instrumentationPayload[k2];
    }
  }

  honey.sendNow(eventData);
};

exports.customContext = {
  add(key, val) {
    let customPayload = tracker.getTracked("custom");
    if (!customPayload) {
      return;
    }

    customPayload[key] = val;
  },
};
