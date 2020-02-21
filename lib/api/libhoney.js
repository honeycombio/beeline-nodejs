/* eslint-env node */
const libhoney = require("libhoney"),
  os = require("os"),
  process = require("process"),
  path = require("path"),
  uuidv4 = require("uuid/v4"),
  url = require("url"),
  tracker = require("../async_tracker"),
  instrumentation = require("../instrumentation"),
  deterministicSampler = require("../deterministic_sampler"),
  schema = require("../schema"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  debug = require("debug")(`${pkg.name}:event`);

const defaultName = "nodejs";

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

const getFilteredOptions = opts => {
  let filteredOptions = {};
  Object.keys(opts).forEach(optionKey => {
    if (optionKey !== "samplerHook" || optionKey !== "presendHook") {
      filteredOptions[optionKey] = opts[optionKey];
    }
  });
  return filteredOptions;
};

module.exports = class LibhoneyEventAPI {
  constructor(opts) {
    if (typeof opts.samplerHook === "function") {
      this.samplerHook = opts.samplerHook;
      debug("using custom samplerHook");
    } else if (opts.samplerHook !== undefined) {
      debug(".samplerHook must be a function. ignoring");
    }

    if (typeof opts.samplerHook !== "function") {
      const sampleRate = opts.sampleRate;

      if (typeof sampleRate === "number") {
        this.samplerHook = deterministicSampler(sampleRate);
        debug("using deterministic sampler with .sampleRate provided.");
      } else if (typeof sampleRate !== "undefined") {
        debug(".sampleRate must be a number.  ignoring.");
      }
    }

    if (typeof opts.presendHook === "function") {
      this.presendHook = opts.presendHook;
      debug("using custom presendHook");
    } else if (opts.presendHook !== undefined) {
      debug(".presendHook must be a function. ignoring");
    }

    let apiHost = process.env["HONEYCOMB_API_HOST"] || "https://api.honeycomb.io";
    let apiUrl = new url.URL(apiHost);
    let proxy;

    if (apiUrl.protocol == "http:") {
      proxy = process.env["HTTP_PROXY"] || process.env["http_proxy"];
    } else {
      proxy = process.env["HTTPS_PROXY"] || process.env["https_proxy"];
    }

    if (proxy) {
      debug(`using proxy ${proxy}`);
    }

    this.defaultDataset = opts.dataset || process.env["HONEYCOMB_DATASET"] || defaultName;

    this.honey = new libhoney(
      Object.assign(
        {
          apiHost,
          proxy,
          dataset: this.defaultDataset,
          writeKey: process.env["HONEYCOMB_WRITEKEY"],
          userAgentAddition: `honeycomb-beeline/${pkg.version}`,
        },
        getFilteredOptions(opts)
      )
    );
    this.honey.add({
      [schema.HOSTNAME]: os.hostname(),
      [schema.TRACE_SERVICE_NAME]: opts.serviceName,
    });
  }

  startTrace(metadataContext, traceId, parentSpanId, dataset) {
    const id = traceId || uuidv4();

    tracker.setTracked({
      id,
      customContext: {},
      stack: [],
      dataset: dataset || this.defaultDataset,
    });
    return this.startSpan(metadataContext, undefined, parentSpanId);
  }

  finishTrace(ev) {
    this.finishSpan(ev);
    tracker.deleteTracked();
  }

  startSpan(metadataContext, spanId = uuidv4(), parentId = undefined) {
    let context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      this.askForIssue("no context in startSpan.");
      return;
    }
    if (context.stack.length > 0) {
      if (parentId) {
        debug("parentId supplied when there are already spans.. wrong.");
      }
      parentId = context.stack[context.stack.length - 1][schema.TRACE_SPAN_ID];
    }
    if (!parentId) {
      parentId = context.parentId;
    }

    const eventPayload = Object.assign({}, metadataContext, {
      [schema.TRACE_ID]: context.id,
      [schema.TRACE_SPAN_ID]: spanId,
      startTime: Date.now(),
      startTimeHR: process.hrtime(),
    });
    if (parentId) {
      eventPayload[schema.TRACE_PARENT_ID] = parentId;
    }
    context.stack.push(eventPayload);
    return eventPayload;
  }

  startAsyncSpan(metadataContext, spanFn) {
    let parentId;
    let spanId = uuidv4();
    let parentContext = tracker.getTracked();
    if (!parentContext) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      this.askForIssue("no parentContext in startAsyncSpan.");
      spanFn({});
      return;
    }
    if (parentContext.stack.length > 0) {
      parentId = parentContext.stack[parentContext.stack.length - 1][schema.TRACE_SPAN_ID];
    }
    if (!parentId) {
      parentId = parentContext.parentId;
    }

    const eventPayload = Object.assign({}, metadataContext, {
      [schema.TRACE_ID]: parentContext.id,
      [schema.TRACE_SPAN_ID]: spanId,
      startTime: Date.now(),
      startTimeHR: process.hrtime(),
    });
    if (parentId) {
      eventPayload[schema.TRACE_PARENT_ID] = parentId;
    }

    let newContext = {
      id: parentContext.id,
      parentId: parentId,
      customContext: parentContext.customContext,
      dataset: parentContext.dataset,
      stack: [eventPayload],
    };

    return tracker.callWithContext(() => spanFn(eventPayload), newContext);
  }

  finishSpan(ev, rollup) {
    debug(`finishing span ${JSON.stringify(ev)}`);
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      this.askForIssue("no context in finishSpan.");
      return;
    }
    if (context.stack.length === 0) {
      // this _really_ shouldn't happen.
      this.askForIssue("no payload for event we're trying to finish (stack is empty).");
      return;
    }
    const idx = context.stack.indexOf(ev);
    if (idx === -1) {
      // again, this _really_ shouldn't happen.
      this.askForIssue("no payload for event we're trying to finish (event not found).");
      return;
    }
    if (idx !== context.stack.length - 1) {
      // the event we're finishing isn't the most deeply nested one. warn the user.
      this.askForIssue(
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
      ev.dataset = context.dataset;
      ev.timestamp = new Date(startTime);
      ev.add(payload);
      ev.add(context.customContext);
      ev.add({
        [schema.INSTRUMENTATIONS]: active_instrumentations,
        [schema.INSTRUMENTATION_COUNT]: active_instrumentation_count,
        [schema.BEELINE_VERSION]: pkg.version,
        [schema.NODE_VERSION]: process.version,
      });

      if (this.samplerHook) {
        debug(`executing sampler hook on event ev = ${JSON.stringify(ev.data)}`);
        const samplerHookResponse = this.samplerHook(ev.data);
        const keepEvent = samplerHookResponse.shouldSample;
        if (!keepEvent) {
          debug(`skipping event due to sampler hook sample ev = ${JSON.stringify(ev.data)}`);
          return;
        }

        if (typeof samplerHookResponse.sampleRate === "number") {
          ev.sampleRate = samplerHookResponse.sampleRate;
        }
      }

      if (this.presendHook) {
        debug(`executing presend hook on event ev = ${JSON.stringify(ev.data)}`);
        this.presendHook(ev);
      }

      debug(`enqueuing presampled event ev = ${JSON.stringify(ev.data)}`);
      ev.sendPresampled();
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

  askForIssue(msg, logger = debug) {
    logger(`-------------------
    ${pkg.name} error: ${msg}
    please paste this message (everything between the "----" lines) into an issue
    at ${pkg.bugs.url}.  feel free to edit
    out any application stack frames if you'd rather not share those
    ${new Error().stack}
    ${this.dumpRequestContext()}
    -------------------`);
  }

  flush() {
    return this.honey.flush();
  }
};
