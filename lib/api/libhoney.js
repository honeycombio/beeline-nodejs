/* eslint-env node */
const libhoney = require("libhoney"),
  os = require("os"),
  process = require("process"),
  url = require("url"),
  crypto = require("crypto"),
  tracker = require("../async_tracker"),
  instrumentation = require("../instrumentation"),
  deterministicSampler = require("../deterministic_sampler"),
  schema = require("../schema"),
  Span = require("./span"),
  pkg = require("../../package.json"),
  debug = require("debug")(`${pkg.name}:event`),
  util = require("../util");

const defaultName = "nodejs";

const incr = (payload, key, val = 1) => {
  payload[key] = (payload[key] || 0) + val;
};

// id generation
const SPAN_ID_BYTES = 8;
const TRACE_ID_BYTES = 16;

function generateTraceId() {
  return crypto.randomBytes(TRACE_ID_BYTES).toString("hex");
}

function generateSpanId() {
  return crypto.randomBytes(SPAN_ID_BYTES).toString("hex");
}

const getFilteredOptions = (opts) => {
  let filteredOptions = {};
  Object.keys(opts).forEach((optionKey) => {
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

    if (!opts.serviceName) {
      opts.serviceName = ["unknown_service", process.name ? process.name.trim() : "nodejs"].join(":");
      console.warn(`empty serviceName configuration option - setting service name to '${opts.serviceName}'`);
    }

    if (!opts.writeKey) {
      console.warn("empty writeKey configuration option");
    }

    if (util.isClassic(opts.writeKey)) {
      let dataset = opts.dataset || process.env["HONEYCOMB_DATASET"];
      if (!dataset || dataset.trim() === "") {
        dataset = defaultName;
        console.warn(`empty dataset configuration option - setting to '${dataset}'`);
      } else {
        dataset = dataset.trim();
      }

      this.defaultDataset = dataset;
    } else {
      if (opts.serviceName !== opts.serviceName.trim()) {
        console.warn(`service name contains whitespace '${opts.serviceName}'`);
      }
      // if servicename is empty (whitespace) or starts with "unknown_service", use "unknown_service"
      // or use trimmed service name
      this.defaultDataset = opts.serviceName.startsWith("unknown_service") || opts.serviceName.trim() === ""
        ? "unknown_service"
        : opts.serviceName.trim();
      if (opts.dataset) {
        console.warn(`dataset should be empty - sending data to '${this.defaultDataset}'`);
      }
    }

    const libhoneyOpts = getFilteredOptions(opts);

    let userAgentAddition = `honeycomb-beeline/${pkg.version}`;
    if (libhoneyOpts.userAgentAddition) {
      userAgentAddition += " " + libhoneyOpts.userAgentAddition;
    }

    this.honey = new libhoney(
      Object.assign(
        {
          apiHost,
          proxy,
          dataset: this.defaultDataset,
          writeKey: process.env["HONEYCOMB_WRITEKEY"],
        },
        libhoneyOpts,
        { userAgentAddition }
      )
    );
    this.honey.add({
      [schema.HOSTNAME]: os.hostname(),
      [schema.TRACE_SERVICE_NAME]: opts.serviceName,
      [schema.TRACE_SERVICE_DOT_NAME]: opts.serviceName,
    });
  }

  // fields and propagatedContext are both objects
  startTrace(fields, traceId, parentSpanId, dataset, propagatedContext) {
    const id = traceId || generateTraceId();

    // initialize an async hook
    tracker.setTracked({
      id,
      traceContext: propagatedContext,
      rollupContext: {},
      stack: [],
      dataset: dataset || this.defaultDataset,
    });
    let span = this.startSpan(fields, undefined, parentSpanId);
    span.addContext({ [schema.META_SPAN_TYPE]: parentSpanId ? "subroot": "root"});
    return span;
  }

  finishTrace(span) {
    const context = tracker.getTracked();
    if (context) {
      // `context` should always be set by this point.  But we use an `if` guard
      // anyway, so we can hit the standard error-handling in `finishSpan`
      // rather than doing some sort of invalid dereference here.

      const rollups = context.rollupContext;
      span.addContext(rollups);
    }

    this.finishSpan(span);
    tracker.deleteTracked();
  }

  startSpan(metadataContext, spanId = generateSpanId(), parentId = undefined) {
    // fetch the currently active trace
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

      // set the parentId to the span id in the most recent entry in the context.stack[]
      parentId = context.stack[context.stack.length - 1].payload[schema.TRACE_SPAN_ID];
    }
    if (!parentId) {
      parentId = context.parentId;
    }

    const span = new Span(
      Object.assign({}, metadataContext, {
        [schema.TRACE_ID]: context.id,
        [schema.TRACE_SPAN_ID]: spanId,
      })
    );
    if (parentId) {
      // add the parent span id field to the Span object
      span.addContext({ [schema.TRACE_PARENT_ID]: parentId });
    }

    // push the newly created Span into the stack
    context.stack.push(span);

    return span;
  }

  startAsyncSpan(metadataContext, spanFn) {
    let parentId;
    let spanId = generateSpanId();
    let parentContext = tracker.getTracked();
    if (!parentContext) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      this.askForIssue("no parentContext in startAsyncSpan.");
      return spanFn({});
    }
    if (parentContext.stack.length > 0) {
      parentId = parentContext.stack[parentContext.stack.length - 1].payload[schema.TRACE_SPAN_ID];
    }
    if (!parentId) {
      parentId = parentContext.parentId;
    }

    const span = new Span(
      Object.assign({}, metadataContext, {
        [schema.TRACE_ID]: parentContext.id,
        [schema.TRACE_SPAN_ID]: spanId,
      })
    );
    if (parentId) {
      span.addContext({ [schema.TRACE_PARENT_ID]: parentId });
    }

    let newContext = {
      id: parentContext.id,
      parentId: parentId,
      traceContext: parentContext.traceContext,
      rollupContext: parentContext.rollupContext,
      dataset: parentContext.dataset,
      stack: [span],
    };

    return tracker.callWithContext(() => spanFn(span), newContext);
  }

  finishSpan(span, rollup) {
    debug("finishing span %j", span);
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      this.askForIssue("no context in finishSpan.");
      return;
    }
    if (context.stack.length === 0) {
      // this _really_ shouldn't happen.
      this.askForIssue("no payload for span we're trying to finish (stack is empty).");
      return;
    }
    const idx = context.stack.indexOf(span);
    if (idx === -1) {
      // again, this _really_ shouldn't happen.
      this.askForIssue("no payload for span we're trying to finish (span not found).");
      return;
    }
    if (idx !== context.stack.length - 1) {
      // the event we're finishing isn't the most deeply nested one. warn the user.
      this.askForIssue(
        "finishing an span with unfinished nested spans. almost certainly not what we want."
      );
    }

    const payload = context.stack[idx].finalizePayload();

    // chop off events after (and including) this one from the stack.
    context.stack = context.stack.slice(0, idx);

    tracker.runWithoutTracking(() => {
      if (rollup) {
        // verify that the stack is not empty.  if it is, we're trying to rollup from a request event
        if (context.stack.length === 0) {
          debug("no event to rollup into");
        } else {
          const rootPayload = context.stack[0].payload;
          const type = payload[schema.EVENT_TYPE];

          // per-rollup rollups
          incr(rootPayload, `totals.${type}.${rollup}.count`);
          incr(rootPayload, `totals.${type}.${rollup}.duration_ms`, payload[schema.DURATION_MS]);

          // per-instrumentation rollups
          incr(rootPayload, `totals.${type}.count`);
          incr(rootPayload, `totals.${type}.duration_ms`, payload[schema.DURATION_MS]);
        }
      }

      const active_instrumentations = instrumentation.activeInstrumentations();
      const active_instrumentation_count = active_instrumentations.length;
      const ev = this.honey.newEvent();
      ev.dataset = context.dataset;
      ev.timestamp = new Date(span.startTime);
      ev.add(payload);
      ev.add(context.traceContext);
      ev.add({
        [schema.INSTRUMENTATIONS]: active_instrumentations,
        [schema.INSTRUMENTATION_COUNT]: active_instrumentation_count,
        [schema.BEELINE_VERSION]: pkg.version,
        [schema.NODE_VERSION]: process.version,
      });

      if (this.samplerHook) {
        debug("executing sampler hook on event ev = %j", ev.data);
        const samplerHookResponse = this.samplerHook(ev.data);
        const keepEvent = samplerHookResponse.shouldSample;
        if (!keepEvent) {
          debug("skipping event due to sampler hook sample ev = %j", ev.data);
          return;
        }

        if (typeof samplerHookResponse.sampleRate === "number") {
          ev.sampleRate = samplerHookResponse.sampleRate;
        }
      }

      if (this.presendHook) {
        debug("executing presend hook on event ev = %j", ev.data);
        this.presendHook(ev);
      }

      debug("enqueuing presampled event ev = %j", ev.data);
      ev.sendPresampled();
    });
  }

  addContext(map) {
    const context = tracker.getTracked();
    if (!context || context.stack.length === 0) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      return;
    }
    const span = context.stack[context.stack.length - 1];
    span.addContext(map);
  }

  addTraceContext(map) {
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      return;
    }
    Object.assign(context.traceContext, map);
  }

  // Unofficial support for rollups, added in a fork of this library.
  //
  // Although the upstream beeline does provide support for rollups, they don't
  // work with async spans, which are used heavily in many instrumentations,
  // including our own.
  //
  // This trace-level rollup tracking should work better in the presence of
  // async spans, though it will of course be unable to report accurately if the
  // rollups are incremented after the trace is already finished.
  //
  // - `key` is the name of the rollup being added to.
  // - `durationMs` is the duration being added to the rollup.
  // - `count` is the counter value being added to the rollup.
  //    It is optional and defaults to 1.
  incrementTraceRollup(key, durationMs, count = 1) {
    const context = tracker.getTracked();
    if (!context) {
      // valid, since we can end up in our instrumentation outside of requests we're tracking
      return;
    }

    let countKey = "rollups." + key + ".count";
    let durationMsKey = "rollups." + key + ".duration_ms";

    context.rollupContext[countKey] = (context.rollupContext[countKey] || 0) + count;
    context.rollupContext[durationMsKey] = (context.rollupContext[durationMsKey] || 0) + durationMs;
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
