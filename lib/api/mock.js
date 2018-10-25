/* eslint-env node */
const process = require("process"),
  path = require("path"),
  pkg = require(path.join(__dirname, "..", "..", "package.json")),
  tracker = require("../async_tracker"),
  schema = require("../schema");

module.exports = class MockEventAPI {
  constructor(opts) {
    this.constructorArg = opts;
    this.customContext = {};
    this.sentEvents = [];
    this.traceId = 0;
  }

  startTrace(metadataContext, traceId) {
    let id = this.traceId++;
    tracker.setTracked({ id: traceId || id, spanId: 50000, stack: [] });
    return this.startSpan(metadataContext, id);
  }
  finishTrace(ev) {
    this.finishSpan(ev);
    tracker.deleteTracked();
  }
  startSpan(metadataContext, spanId = undefined, parentId = undefined) {
    let context = tracker.getTracked();
    if (context.stack.length > 0) {
      parentId = context.stack[context.stack.length - 1][schema.TRACE_SPAN_ID];
    }
    const eventPayload = Object.assign({}, metadataContext, {
      [schema.TRACE_ID]: context.id,
      [schema.TRACE_SPAN_ID]: spanId || ++context.spanId,
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
    let context = tracker.getTracked();
    let spanId = context.spanId + 1000;
    if (context.stack.length > 0) {
      parentId = context.stack[context.stack.length - 1][schema.TRACE_SPAN_ID];
    }

    const eventPayload = Object.assign({}, metadataContext, {
      [schema.TRACE_ID]: context.id,
      [schema.TRACE_SPAN_ID]: ++spanId,
      startTime: Date.now(),
      startTimeHR: process.hrtime(),
    });
    if (parentId) {
      eventPayload[schema.TRACE_PARENT_ID] = parentId;
    }

    let newContext = {
      id: context.id,
      spanId,
      stack: [eventPayload],
    };

    return tracker.callWithContext(() => spanFn(eventPayload), newContext);
  }

  finishSpan(ev, _rollup) {
    Object.assign(ev, this.customContext, {
      [schema.DURATION_MS]: 0,
      [schema.BEELINE_VERSION]: pkg.version,
    });
    let context = tracker.getTracked();
    // pop it off the stack
    const idx = context.stack.indexOf(ev);
    this.eventStack = context.stack.slice(0, idx);
    this.sentEvents.push(ev);
  }
  addContext(map) {
    Object.assign(this.customContext, map);
  }
  removeContext(key) {
    delete this.customContext[key];
  }
};
