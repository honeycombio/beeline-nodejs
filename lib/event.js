/* global require exports console */
const process = require("process"),
  libhoney = require("libhoney").default,
  uuidv4 = require("uuid/v4"),
  uppercamelcase = require("uppercamelcase"),
  tracker = require("./async_tracker"),
  magic = require("./magic");

let eventAPI;

function configure(opts = {}) {
  if (eventAPI) {
    return;
  }

  let api = LibhoneyEventAPI;
  if (opts.api) {
    if (opts.api === "libhoney-event") {
      api = LibhoneyEventAPI;
    } else if (opts.api === "mock") {
      api = MockEventAPI;
    } else {
      throw new Error("Unrecognized .api.  valid options are 'libhoney-event' / 'mock'");
    }
  }
  eventAPI = new api(opts);
}

function apiForTesting() {
  return eventAPI;
}

function resetForTesting() {
  eventAPI = null;
}

const defaultName = "nodejs";

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

class MockEventAPI {
  constructor(opts) {
    this.constructorArg = opts;
    this.eventStack = [];
    this.sentEvents = [];
  }

  startRequest(source) {
    return this.startEvent(null, source);
  }
  finishRequest(ev, durationMSField) {
    this.finishEvent(ev, null, durationMSField);
  }
  startEvent(context, source) {
    const eventPayload = {
      "meta.request_id": context.id,
      "meta.type": source, // XXX(toshok) rename "type" to "source"?
      startTime: Date.now(),
    };
    this.eventStack.push(eventPayload);
    return eventPayload;
  }
  finishEvent(ev, rollup, duration_ms_field) {
    Object.assign(ev, {
      appEventPrefix: rollup,
      [duration_ms_field]: 0,
    });
    // pop it off the stack
    const idx = this.eventStack.indexOf(ev);
    this.eventStack = this.eventStack.slice(0, idx);
    this.sentEvents.push(ev);
  }
  addContext(map) {
    const ev = this.eventStack[this.eventStack.length - 1];
    Object.assign(ev, map);
  }
}

class LibhoneyEventAPI {
  constructor(opts) {
    this.honey = new libhoney(
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

  startRequest(source) {
    const requestContext = {
      id: uuidv4(),
      stack: [],
    };
    tracker.setTracked(requestContext);
    return this.startEvent(requestContext, source);
  }

  finishRequest(ev, durationMSField) {
    this.finishEvent(ev, null, durationMSField);
    tracker.deleteTracked();
  }

  startEvent(context, source) {
    const eventPayload = {
      "meta.request_id": context.id,
      "meta.type": source, // XXX(toshok) rename "type" to "source"?
      startTime: Date.now(),
    };
    context.stack.push(eventPayload);
    return eventPayload;
  }

  finishEvent(ev, rollup, duration_ms_field = "duration_ms") {
    const endTime = Date.now();
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      return;
    }
    if (context.stack.length === 0) {
      // this _really_ shouldn't happen.
      console.error("no payload for event we're trying to finish (stack is empty).");
      return;
    }
    const idx = context.stack.indexOf(ev);
    if (idx === -1) {
      // again, this _really_ shouldn't happen.
      console.error("no payload for event we're trying to finish (event not found).");
      return;
    }
    if (idx !== context.stack.length - 1) {
      // the event we're finishing isn't the most deeply nested one. warn the user.
      console.error(
        "finishing an event with unfinished child events. almost certainly not what we want. expect more errors"
      );
    }

    const payload = context.stack[idx];

    const startTime = payload.startTime;
    const duration_ms = (endTime - startTime) / 1000;
    payload[duration_ms_field] = duration_ms;
    delete payload.startTime;

    // chop off events after (and including) this one from the stack.
    context.stack = context.stack.slice(0, idx);

    tracker.runWithoutTracking(() => {
      if (rollup) {
        // verify that the stack is not empty.  if it is, we're trying to rollup from a request event
        if (context.stack.length === 0) {
          console.error("no event to rollup into");
        } else {
          const rootPayload = context.stack[0];
          const rootType = rootPayload["meta.type"];
          const type = payload["meta.type"];
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
      const ev = this.honey.newEvent();
      ev.timestamp = new Date(startTime);
      ev.add(payload);
      ev.add({
        "meta.instrumentations": active_instrumentations,
        "meta.instrumentation_count": active_instrumentation_count,
      });
      ev.send();
    });
  }

  addContext(map) {
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      return;
    }
    if (context.stack.length === 0) {
      // this _really_ shouldn't happen.
      console.error("no payload to add context to.");
      return;
    }
    const currentPayload = context.stack[context.stack.length - 1];
    Object.assign(currentPayload, map);
  }
}

const customContext = {
  add(key, val) {
    eventAPI.addContext({ [`custom.${key}`]: val });
  },
};

exports.configure = configure;
exports.apiForTesting = apiForTesting;
exports.resetForTesting = resetForTesting;
exports.startRequest = function startRequest(source) {
  return eventAPI.startRequest(source);
};
exports.finishRequest = function finishRequest(ev, durationMSField) {
  return eventAPI.finishRequest(ev, durationMSField);
};
exports.addContext = function addContext(map) {
  return eventAPI.addContext(map);
};
exports.startEvent = function startEvent(context, source) {
  return eventAPI.startEvent(context, source);
};
exports.finishEvent = function finishEvent(ev, rollup, duration_ms_field) {
  return eventAPI.finishEvent(ev, rollup, duration_ms_field);
};
exports.customContext = customContext;
