/* global require exports __dirname */
const debug = require("debug")("honeycomb-magic"),
  libhoney = require("libhoney").default,
  process = require("process"),
  path = require("path"),
  uuidv4 = require("uuid/v4"),
  uppercamelcase = require("uppercamelcase"),
  tracker = require("./async_tracker"),
  magic = require("./magic"),
  pkg = require(path.join(__dirname, "..", "package.json"));

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
  debug(`using api: ${api == LibhoneyEventAPI ? "libhoney-event" : "mock"}`);
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
      startTine: process.hrtime(),
    };
    this.eventStack.push(eventPayload);
    return eventPayload;
  }
  finishEvent(ev, rollup, durationMsField) {
    Object.assign(ev, {
      appEventPrefix: rollup,
      [durationMsField]: 0,
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
          userAgentAddition: `honeycomb-nodejs ${pkg.version} events`,
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
      startTimeHR: process.hrtime(),
    };
    context.stack.push(eventPayload);
    return eventPayload;
  }

  finishEvent(ev, rollup, durationMsField = "duration_ms") {
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      return;
    }
    if (context.stack.length === 0) {
      // this _really_ shouldn't happen.
      debug("no payload for event we're trying to finish (stack is empty).");
      return;
    }
    const idx = context.stack.indexOf(ev);
    if (idx === -1) {
      // again, this _really_ shouldn't happen.
      debug("no payload for event we're trying to finish (event not found).");
      return;
    }
    if (idx !== context.stack.length - 1) {
      // the event we're finishing isn't the most deeply nested one. warn the user.
      debug(
        "finishing an event with unfinished child events. almost certainly not what we want. expect more errors"
      );
    }

    const payload = context.stack[idx];

    const { startTime, startTimeHR } = payload;
    const duration = process.hrtime(startTimeHR);
    const durationMs = (duration[0] * 1e9 + duration[1]) / 1e6;
    payload[durationMsField] = durationMs;
    delete payload.startTime;
    delete payload.startTimeHR;

    // chop off events after (and including) this one from the stack.
    context.stack = context.stack.slice(0, idx);

    tracker.runWithoutTracking(() => {
      if (rollup) {
        // verify that the stack is not empty.  if it is, we're trying to rollup from a request event
        if (context.stack.length === 0) {
          debug("no event to rollup into");
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
            durationMs
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
      debug("no payload to add context to.");
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
exports.finishEvent = function finishEvent(ev, rollup, durationMsField) {
  return eventAPI.finishEvent(ev, rollup, durationMsField);
};
exports.customContext = customContext;
