/* global require exports __dirname */
const debug = require("debug")("honeycomb-magic:event"),
  libhoney = require("libhoney").default,
  process = require("process"),
  path = require("path"),
  uuidv4 = require("uuid/v4"),
  tracker = require("./async_tracker"),
  magic = require("./magic"),
  schema = require("./schema"),
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
    this.requestId = 0;
  }

  startRequest(source, requestId) {
    let id = this.requestId++;
    let requestContext = { id: requestId || id };
    tracker.setTracked(requestContext);
    return this.startEvent(requestContext, source);
  }
  finishRequest(ev) {
    this.finishEvent(ev, null);
    tracker.deleteTracked();
  }
  startEvent(context, source) {
    const eventPayload = {
      [schema.REQUEST_ID]: context.id,
      [schema.EVENT_TYPE]: source,
      startTime: Date.now(),
      startTimeHR: process.hrtime(),
    };
    this.eventStack.push(eventPayload);
    return eventPayload;
  }
  finishEvent(ev, rollup) {
    Object.assign(ev, {
      appEventPrefix: rollup,
      [schema.DURATION_MS]: 0,
      [schema.ONRAMP_VERSION]: pkg.version,
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
          userAgentAddition: `honeycomb-beeline/${pkg.version}`,
        },
        opts
      )
    );
  }

  startRequest(source, requestId) {
    const requestContext = {
      id: requestId || uuidv4(),
      stack: [],
    };
    tracker.setTracked(requestContext);
    return this.startEvent(requestContext, source);
  }

  finishRequest(ev) {
    this.finishEvent(ev, null);
    tracker.deleteTracked();
  }

  startEvent(context, source) {
    const eventPayload = {
      [schema.REQUEST_ID]: context.id,
      [schema.EVENT_TYPE]: source,
      startTime: Date.now(),
      startTimeHR: process.hrtime(),
    };
    context.stack.push(eventPayload);
    return eventPayload;
  }

  finishEvent(ev, rollup) {
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      askForIssue("no context in finishEvent.");
      return;
    }
    if (context.stack.length === 0) {
      // this _really_ shouldn't happen.
      askForIssue("no payload for event we're trying to finish (stack is empty).");
      return;
    }
    const idx = context.stack.indexOf(ev);
    if (idx === -1) {
      // again, this _really_ shouldn't happen.
      askForIssue("no payload for event we're trying to finish (event not found).");
      return;
    }
    if (idx !== context.stack.length - 1) {
      // the event we're finishing isn't the most deeply nested one. warn the user.
      askForIssue(
        "finishing an event with unfinished nested events. almost certainly not what we want."
      );
    }

    const payload = context.stack[idx];

    const { startTime, startTimeHR } = payload;
    const duration = process.hrtime(startTimeHR);
    const durationMs = (duration[0] * 1e9 + duration[1]) / 1e6;
    payload[schema.DURATION_MS] = durationMs;
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
          const type = payload[schema.EVENT_TYPE];

          // per-rollup rollups
          incr(rootPayload, `totals.${type}_${rollup}_count`);
          incr(rootPayload, `totals.${type}_${rollup}_duration_ms`, durationMs);

          // per-instrumentation rollups
          incr(rootPayload, `totals.${type}_count`);
          incr(rootPayload, `totals.${type}_duration_ms`, durationMs);
        }
      }

      const active_instrumentations = magic.activeInstrumentations();
      const active_instrumentation_count = active_instrumentations.length;
      const ev = this.honey.newEvent();
      ev.timestamp = new Date(startTime);
      ev.add(payload);
      ev.add({
        [schema.INSTRUMENTATIONS]: active_instrumentations,
        [schema.INSTRUMENTATION_COUNT]: active_instrumentation_count,
        [schema.ONRAMP_VERSION]: pkg.version,
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

  dumpRequestContext() {
    const context = tracker.getTracked();
    if (!context) {
      return "";
    }
    return ["current request context:"]
      .concat(context.stack.map((payload, idx) => `${idx}: ${JSON.stringify(payload)}`))
      .join("\n");
  }
}

const customContext = {
  add(key, val) {
    eventAPI.addContext({ [schema.customColumn(key)]: val });
  },
};

exports.configure = configure;
exports.apiForTesting = apiForTesting;
exports.resetForTesting = resetForTesting;
exports.startRequest = function startRequest(source, requestId) {
  return eventAPI.startRequest(source, requestId);
};
exports.finishRequest = function finishRequest(ev) {
  return eventAPI.finishRequest(ev);
};
exports.addContext = function addContext(map) {
  return eventAPI.addContext(map);
};
exports.startEvent = function startEvent(context, source) {
  return eventAPI.startEvent(context, source);
};
exports.finishEvent = function finishEvent(ev, rollup) {
  return eventAPI.finishEvent(ev, rollup);
};
const dumpRequestContext = (exports.dumpRequestContext = function dumpRequestContext() {
  return eventAPI.dumpRequestContext();
});
exports.customContext = customContext;

const askForIssue = (exports.askForIssue = (msg, logger = debug) => {
  logger(`-------------------
honeycomb-nodejs-magic error: ${msg}
please paste this message (everything between the "----" lines) into an issue
at https://github.com/honeycombio/honeycomb-nodejs-magic/issues.  feel free to edit
out any application stack frames if you'd rather not share those
${new Error().stack}
${dumpRequestContext()}
-------------------`);
});
