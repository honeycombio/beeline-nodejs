/* eslint-env node */
const path = require("path"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`),
  LibhoneyEventAPI = require("./libhoney"),
  MockEventAPI = require("./mock");

let eventAPI;

module.exports = {
  configure(opts = {}) {
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
  },

  traceActive() {
    return !!tracker.getTracked();
  },

  startRequest(metadataContext, traceId, parentSpanId) {
    return eventAPI.startRequest(metadataContext, traceId, parentSpanId);
  },
  finishRequest(event) {
    return eventAPI.finishRequest(event);
  },
  startEvent(metadataContext, spanId) {
    return eventAPI.startEvent(metadataContext, spanId);
  },
  finishEvent(ev, rollup) {
    return eventAPI.finishEvent(ev, rollup);
  },
  addContext(map) {
    return eventAPI.addContext(map);
  },
  removeContext(key) {
    return eventAPI.removeContext(key);
  },
  customContext: {
    add(key, val) {
      eventAPI.addContext({ [schema.customContext(key)]: val });
    },
    remove(key) {
      eventAPI.removeContext(schema.customContext(key));
    },
  },
  askForIssue(msg, logger = debug) {
    return eventAPI.askForIssue(msg, logger);
  },

  // these are exposed just for tests.  don't use them.
  _apiForTesting() {
    return eventAPI;
  },
  _resetForTesting() {
    eventAPI = null;
  },
};
