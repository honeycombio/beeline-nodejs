/* global require exports __dirname */
const libhoney = require("libhoney").default,
  os = require("os"),
  process = require("process"),
  path = require("path"),
  uuidv4 = require("uuid/v4"),
  tracker = require("./async_tracker"),
  instrumentation = require("./instrumentation"),
  DeterministicSampler = require("./deterministic_sampler"),
  schema = require("./schema"),
  pkg = require(path.join(__dirname, "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`);

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
    this.customContext = {};
    this.eventStack = [];
    this.sentEvents = [];
    this.traceId = 0;
  }

  startRequest(metadataContext, traceId) {
    let id = this.traceId++;
    tracker.setTracked({ id: traceId || id });
    return this.startEvent(metadataContext);
  }
  finishRequest(ev) {
    this.finishEvent(ev);
    tracker.deleteTracked();
  }
  startEvent(metadataContext) {
    let context = tracker.getTracked();
    const eventPayload = Object.assign({}, metadataContext, {
      [schema.TRACE_ID]: context.id,
      startTime: Date.now(),
      startTimeHR: process.hrtime(),
    });
    this.eventStack.push(eventPayload);
    return eventPayload;
  }
  finishEvent(ev, _rollup) {
    Object.assign(ev, this.customContext, {
      [schema.DURATION_MS]: 0,
      [schema.BEELINE_VERSION]: pkg.version,
    });
    // pop it off the stack
    const idx = this.eventStack.indexOf(ev);
    this.eventStack = this.eventStack.slice(0, idx);
    this.sentEvents.push(ev);
  }
  addContext(map) {
    Object.assign(this.customContext, map);
  }
  removeContext(key) {
    delete this.customContext[key];
  }
}

class LibhoneyEventAPI {
  constructor(opts) {
    let sampleRate;
    let optsWithoutSampleRate = {};
    Object.keys(opts).forEach(k => {
      if (k === "sampleRate") {
        sampleRate = opts[k];
      } else {
        optsWithoutSampleRate[k] = opts[k];
      }
    });
    if (typeof sampleRate === "number") {
      this.ds = new DeterministicSampler(sampleRate);
    } else if (typeof sampleRate !== "undefined") {
      debug(".sampleRate must be a number.  ignoring.");
    }

    this.honey = new libhoney(
      Object.assign(
        {
          apiHost: process.env["HONEYCOMB_API_HOST"] || "https://api.honeycomb.io",
          writeKey: process.env["HONEYCOMB_WRITEKEY"],
          dataset: process.env["HONEYCOMB_DATASET"] || defaultName,
          userAgentAddition: `honeycomb-beeline/${pkg.version}`,
        },
        optsWithoutSampleRate
      )
    );
    this.honey.addField(schema.HOSTNAME, os.hostname());
  }

  startRequest(metadataContext, traceId) {
    let id = traceId || uuidv4();

    if (this.ds && !this.ds.sample(id)) {
      // don't create the context at all if this request isn't going to send a trace
      return null;
    }

    tracker.setTracked({
      id,
      customContext: {},
      stack: [],
    });
    return this.startEvent(metadataContext, id);
  }

  finishRequest(ev) {
    this.finishEvent(ev);
    tracker.deleteTracked();
  }

  startEvent(metadataContext, spanId = uuidv4()) {
    let context = tracker.getTracked();
    let parentId;
    if (context.stack.length > 0) {
      parentId = context.stack[context.stack.length - 1][schema.TRACE_SPAN_ID];
    }
    const eventPayload = Object.assign({}, metadataContext, {
      [schema.TRACE_ID]: context.id,
      [schema.TRACE_SPAN_ID]: spanId,
      [schema.TRACE_SERVICE_NAME]: "XXX(toshok)",
      startTime: Date.now(),
      startTimeHR: process.hrtime(),
    });
    if (parentId) {
      eventPayload[schema.TRACE_PARENT_ID] = parentId;
    }
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
          incr(rootPayload, `totals.${type}.${rollup}.count`);
          incr(rootPayload, `totals.${type}.${rollup}.duration_ms`, durationMs);

          // per-instrumentation rollups
          incr(rootPayload, `totals.${type}.count`);
          incr(rootPayload, `totals.${type}.duration_ms`, durationMs);
        }
      }

      const active_instrumentations = instrumentation.activeInstrumentations();
      const active_instrumentation_count = active_instrumentations.length;
      const ev = this.honey.newEvent();
      ev.timestamp = new Date(startTime);
      ev.add(payload);
      ev.add(context.customContext);
      ev.add({
        [schema.INSTRUMENTATIONS]: active_instrumentations,
        [schema.INSTRUMENTATION_COUNT]: active_instrumentation_count,
        [schema.BEELINE_VERSION]: pkg.version,
        [schema.NODE_VERSION]: process.version,
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
    Object.assign(context.customContext, map);
  }

  removeContext(key) {
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      return;
    }
    delete context.customContext[key];
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
    eventAPI.addContext({ [schema.customContext(key)]: val });
  },
  remove(key) {
    eventAPI.removeContext(schema.customContext(key));
  },
};

exports.configure = configure;
exports.apiForTesting = apiForTesting;
exports.resetForTesting = resetForTesting;
exports.traceActive = function traceActive() {
  return !!tracker.getTracked();
};
exports.startRequest = function startRequest(metadataContext, traceId) {
  return eventAPI.startRequest(metadataContext, traceId);
};
exports.finishRequest = function finishRequest(ev) {
  return eventAPI.finishRequest(ev);
};
exports.addContext = function addContext(map) {
  return eventAPI.addContext(map);
};
exports.startEvent = function startEvent(metadataContext, spanId) {
  return eventAPI.startEvent(metadataContext, spanId);
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
${pkg.name} error: ${msg}
please paste this message (everything between the "----" lines) into an issue
at ${pkg.bugs}.  feel free to edit
out any application stack frames if you'd rather not share those
${new Error().stack}
${dumpRequestContext()}
-------------------`);
});
