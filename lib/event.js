const libhoney = require("libhoney").default,
  uuidv4 = require("uuid/v4"),
  uppercamelcase = require("uppercamelcase"),
  tracker = require("./async_tracker"),
  magic = require("./magic");

let honey;

const defaultName = "nodejs";

function configure(opts) {
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
}

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

function startRequest(source) {
  let requestContext = {
    id: uuidv4(),
    stack: [],
  };
  tracker.setTracked(requestContext);
  return startEvent(requestContext, source);
}

function finishRequest(ev, durationMSField) {
  finishEvent(ev, null, durationMSField);
}

function startEvent(context, source) {
  let eventPayload = {
    "meta.request_id": context.id,
    "meta.type": source, // XXX(toshok) rename "type" to "source"?
    startTime: Date.now(),
  };
  context.stack.push(eventPayload);
  return eventPayload;
}

function finishEvent(ev, rollup, duration_ms_field = "duration_ms") {
  let endTime = Date.now();
  let context = tracker.getTracked();
  if (!context) {
    // valid, since we can end up in our instrumentation outside of requests we're tracking
    return;
  }
  if (context.stack.length === 0) {
    // this _really_ shouldn't happen.
    console.error("no payload for event we're trying to finish.");
    return;
  }
  let idx = context.stack.indexOf(ev);
  if (idx === -1) {
    // again, this _really_ shouldn't happen.
    console.error("no payload for event we're trying to finish.");
    return;
  }
  if (idx !== context.stack.length - 1) {
    // the event we're finishing isn't the most deeply nested one. warn the user.
    console.error(
      "finishing an event with unfinished child events. almost certainly not what we want. expect more errors"
    );
  }

  let payload = context.stack[idx];

  let startTime = payload.startTime;
  let duration_ms = (endTime - startTime) / 1000;
  delete payload.startTime;

  // chop off events after (and including) this one from the stack.
  context.stack = context.stack.slice(idx + 1);

  tracker.runWithoutTracking(() => {
    if (rollup) {
      // verify that the stack is not empty.  if it is, we're trying to rollup from a request event
      if (context.stack.length === 0) {
        console.error("no event to rollup into");
      } else {
        let rootPayload = context.stack[0];
        let rootType = rootPayload.type;
        let type = payload.type;
        incr(
          rootPayload,
          `${rootType}.total${uppercamelcase(type)}${uppercamelcase(rollup)}_count`
        );
        incr(
          rootPayload,
          `${rootType}.total${uppercamelcase(type)}${uppercamelcase(rollup)}Duration_ms`,
          duration_ms
        );
      }
    }

    const active_instrumentations = magic.activeInstrumentations();
    const active_instrumentation_count = active_instrumentations.length;
    let ev = honey.newEvent();
    ev.timestamp = new Date(startTime);
    ev.add(payload);
    ev.add({
      [duration_ms_field]: duration_ms,
      "meta.instrumentations": active_instrumentations,
      "meta.instrumentation_count": active_instrumentation_count,
    });
    ev.send();
  });
}

function addContext(map) {
  let context = tracker.getTracked();
  if (!context) {
    // valid, since we can end up in our instrumentation outside of requests we're tracking
    return;
  }
  if (context.stack.length === 0) {
    // this _really_ shouldn't happen.
    console.error("no payload to add context to.");
    return;
  }
  let currentPayload = context.stack[context.stack.length - 1];
  Object.assign(currentPayload, map);
}

const customContext = {
  add(key, val) {
    addContext({ [`custom.${key}`]: val });
  },
};

exports.configure = configure;
exports.startRequest = startRequest;
exports.finishRequest = finishRequest;
exports.addContext = addContext;
exports.startEvent = startEvent;
exports.finishEvent = finishEvent;
exports.customContext = customContext;
