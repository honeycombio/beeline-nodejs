**This document is intended for anyone looking to write custom instrumentation for your favorite NPM package.**

If you're looking to understand how to **use** the Beeline for Node.js in your application,
please check out our [Usage and Examples](https://docs.honeycomb.io/beeline/nodejs/) documentation instead.

## Accessing the API

Everything in this document is available off the module you import:

```javascript
const beeline = require("honeycomb-beeline")();

/* beeline.traceActive() works, as do all the other calls below */
```

There are a few surfaces to the API:

1.  [Traces and spans](#traces-and-spans)
2.  [Interprocess trace propagation](#interprocess-trace-propagation)
3.  [Adding context to spans](#adding-context-to-spans)
4.  [Async context bookkeeping](#async-context-bookkeeping)

### Traces and spans

In general you're going to be creating spans more often than traces. If you're using express, you may not ever have to use any of the trace API.

#### startTrace()

```javascript
beeline.startTrace(metadataContext[, withTraceId, withParentSpanId])
```

Starts a new local trace and initializes the async context propagation machinery. You _must_ have an active trace for the rest of the API to do anything. If you call `startSpan` when you aren't currently in an trace, an `Error` will be thrown. The instrumentations (which must operate in both trace/non-trace environments) handle this by checking `beeline.traceActive()` and only creating spans if they're within a trace.

This method also creates the root span for the trace (using `beeline.startSpan` below), and adds `metadataContext` as its initial context. This
root span is installed as the current span.

Returns a reference to the trace.

For an explanation of `withTraceId` and `withParentSpanId`, see [Interprocess trace propagation](#interprocess-trace-propagation) below.

example:

```javascript
let rootSpan = beeline.startTrace({
  field1: value1,
  field2: value2,
});
```

#### finishTrace()

```javascript
beeline.finishTrace(rootSpan);
```

Sends the trace's root span, and tears down the async context propagation machinery. This _must_ be called in order to send the root span.

example:

```javascript
let rootSpan = beeline.startTrace({
  task: "writing a file",
  filePath,
});
fs.writeFile(filePath, fileContents, err => {
  beeline.customContext.add("fileError", err.toString());
  beeline.finishTrace(rootSpan);
});
```

#### withTrace()

```javascript
beeline.withTrace(metadataContext, fn);
```

If you're doing something synchronously (maybe in a script) and your entire trace can be expressed as a single function `fn`, you can use `withTrace()` to simplify things. It safely wraps the invocation of `fn` with `startTrace()` and `finishTrace()` calls. It returns the return value of fn, so can be used in a expression context.

As with `startTrace()`, `metadataContext` is the map of initial properties for the root span. The trace's root span is also installed as the current span.

example

```javascript
beeline.withTrace(
  {
    task: "writing a file",
    filePath,
  },
  () => fs.writeFileSync(filePath, fileContents)
);

// Another example of withTrace, in an expression context:
console.log(
  `the answer is ${beeline.withTrace(
    {
      task: "computing fibonacci number",
      n,
    },
    () => computeFib(n)
  )}`
);
```

#### startSpan()

```javascript
beeline.startSpan(metadataContext);
```

Starts a new span within an existing trace. This new span is added as a child of the current span, and recorded as the current span.

If the span is part of an asynchronous operation (e.g. it might end outside its parent's bounds), use `startAsyncSpan` instead.

Returns a reference to the span (to be used in `finishSpan` below.)

example:

```javascript
let span = beeline.startSpan({
  task: "writing a file",
  filePath,
});
fs.writeFile(filePath, fileContents, err => {
  beeline.customContext.add("fileError", err.toString());
  beeline.finishSpan(span);
});
```

#### startAsyncSpan

```javascript
beeline.startAsyncSpan(metadataContext, spanFn);
```

Starts a new async span within an existing trace. This new span is added as a child of the current span, and recorded as the current
span within the context of calling `spanFn`. Outside of `spanFn` the current span is unchanged. The newly created span is passed as
the only argument to `spanFn` (to be used in `finishSpan` below.)

Async spans are the norm within the beeline-packaged instrumentation, and you should use them for all asynchronous operations&mdash;e.g. if the child might end outside its parent's bounds.

example:

```javascript
beeline.startAsyncSpan({
    task: "writing a file",
    filePath,
}, span => {
       fs.writeFile(filePath, fileContents, err => {
           beeline.customContext.add("fileError", err.toString());
           beeline.finishSpan(span);
       });
   }
});
```

#### finishSpan()

```javascript
beeline.finishSpan(span);
```

Emits an event to honeycomb containing all the context for this span. Pops the span stack such that the parent span is now the current span.

The beeline assumes that within a process, child spans complete before their parent spans. If you finish a parent span before all children have been finished we'll emit a warning.

example:

```javascript
// assuming startTrace called before, the trace's root span is the current span

let parentSpan = beeline.startSpan({
  name: "parent span",
});

// since the root span is the current span, parentSpan added as a child of it.
// parentSpan is now the current span.

let childSpan = beeline.startSpan({
  name: "childSpan span",
});

// since parentSpan is the current span, childSpan added as a child of it.
// childSpan is now the current span.

beeline.finishSpan(childSpan);

// childSpan's data has been sent to honeycomb.
// now parentSpan is the current span

beeline.finishSpan(parentSpan);
// parentSpan's data has been sent to honeycomb.
```

#### withSpan()

If you're doing something synchronously (looping, for instance, or using a synchronous node api) you can use `withSpan` to wrap this operation. It safely wraps the invocation of `fn` with `startSpan()` and `finishSpan()` calls. It returns the return value of fn, so can be used in a expression context.

As with `startSpan()`, `metadataContext` is the map of initial properties for the span. The span created by `withSpan` is added as a child of the current span, and the child installed as current span for the execution of `fn`.

example

```javascript
let sum = beeline.withSpan(
  {
    task: "calculating the sum",
  },
  () => {
    let s = 0;
    for (let i of bigArray) {
      s += i;
    }
    return s;
  }
);
```

### Interprocess trace propagation

If you're dealing with multiple services (either on the same host or different ones) and want the services to all participate in the same trace, some information about the trace itself needs to be propagated on outbound calls (and then consumed on the other side.) For outbound http/https and inbound express, the propagation happens automatically. The following APIs exist to ease the task of adding propagation to other transports.

#### marshalTraceContext()

```javascript
beeline.marshalTraceContext(beeline.getTraceContext());
```

Returns a serialized form of the current trace context (including the trace id and the current span), encoded as a string. The format is documented at https://github.com/honeycombio/beeline-nodejs/blob/master/lib/propagation.js#L16

example:

```javascript
let traceContext = beeline.marshalTraceContext(beeline.getTraceContext());
console.log(traceContext); // => 1;trace_id=weofijwoeifj,parent_id=owefjoweifj,context=SGVsbG8gV29ybGQ=
```

#### unmarshalTraceContext()

```javascript
beeline.unmarshalTraceContext(traceContext);
```

Returns an object containing the properties `traceId` and `parentSpanId`, which are the two optional parameters with `startTrace()` above.

example:

```javascript
let { traceId, parentSpanId } = beeline.unmarshalTraceContext(
  req.header[beeline.TRACE_HTTP_HEADER]
);

let trace = startTrace({ name }, traceId, parentSpanId);
```

#### TRACE_HTTP_HEADER

The HTTP header that the beeline uses both for sending and receiving trace context. The value is `"X-Honeycomb-Trace"`.

#### How to use it? An example

Imagine two services written in Javascript using a bespoke RPC transport, with service1 making a call to service2. Each service starts and finishes its own local trace, but by virtue of the marshalTraceContext/unmarshalTraceContext apis, uses the same trace ID for both (so all spans from both services are stitched together into the same distributed trace.)

service1:

```javascript
// this next line isn't necessary if you're within an express handler
let trace = beeline.startTrace();

let traceContext = beeline.marshalTraceContext(beeline.getTraceContext);
try {
  await service2Client.doSomething({
    // add the traceContext in our RPC call payload
    traceContext,
    arg1: val1,
    arg2: val2,
  });
} finally {
  // make sure we finish our local trace regardless if doSomething succeeds or not.
  beeline.finishTrace(trace);
}
```

service2:

```javascript
let service2 = createBespokeServer();

// the handler for the `doSomething` call above
service2.on("something", async payload => {
  let { traceContext, ...restOfPayload } = payload;
  let { traceId, parentSpanId } = traceContext;

  // passing traceId+parentSpanId causes this local trace to be stitched
  // into the greater distributed trace.
  beeline.startTrace(
    {
      name: "something",
    },
    traceId,
    parentSpanId
  );

  try {
    await handleSomething(restOfPayload);
  } finally {
    beeline.finishTrace();
  }
});
```

### Adding context to spans

_[TODO: This part is most likely to see changes as we figure out inter-process trace context propagation]_

There are two axes to useful traces: depth and width. Depth is a measure of how many operations are performed, and width is a measure of how much information there is to associate with each operation. Depth is addressed by the startSpan/finishSpan. Width is addressed by the methods in this section.

#### span.addContext()

```javascript
// given a reference to a span (from startTrace, startSpan, startAsyncSpan)
span.addContext(contextMap);
```

Adds all key/value pairs in `contextMap` as toplevel fields on the current span. Context added with this method is _only_ attached to the current span. For attaching context to all spans sent after this call, use `addTraceContext`. Unlike `addContext` below, `span.addContext` does not prepend `app.`. It is primarily intended for use in instrumentations that maintain their own prefixes.

#### addTraceContext()

```javascript
beeline.addTraceContext(contextMap);
```

Adds all key/value pairs in `contextMap` as toplevel fields on the current span, prepending `app.` This context will be attached to all spans sent after the call to `addTraceContext`, and all fields will be propagated to downstream/outbound http/https requests.

#### addContext()

```javascript
beeline.addContext(contextMap);
```

Adds all key/value pairs in `contextMap` as toplevel fields on the current span. Should only be used when writing your own instrumentation. Context added with this method is _only_ attached to the current span. We recommend using `customContext.add()` for application-specific context, as `customContext.add()`-added context will be attached to all spans sent after it was added.

In the next major version, this method will be changed to prepend `app.` to keys, much like `addTraceContext` above.

example:

```javascript
beeline.addContext({
  field1: value1,
  field2: value2,
});
```

#### removeContext()

```javascript
beeline.removeContext(key);
```

Removes a single `key` (and its value) from the fields on the current span. A noop if the key doesn't exist.

example:

```javascript
beeline.removeContext(fieldName);
```

Deprecated: this method will be removed in the next major release.

#### customContext.add()

```javascript
beeline.customContext.add(key, value);
```

Adds a single key/value pair as a field on the current span. The key is automatically prefixed with `app.` to set it apart from (and keep from conflicting with) the instrumentation-added fields. Custom context is attached to all spans sent after the call to `customContext.add` call.

example:

```javascript
beeline.customContext.add("userName", "toshok");
// adds the key/value pair { "app.userName": "toshok" } to the current span, and all those that sent after.
```

Deprecated: this method will be removed in the next major release. Please use `.addTraceContext` above.

#### customContext.remove()

```javascript
beeline.customContext.remove(key);
```

Removes a single key/value pair from the current span. A noop if the key doesn't exist.

example:

```javascript
beeline.customContext.remove("userName");
```

Deprecated: this method will be removed in the next major release.

#### startTimer()

```javascript
beeline.startTimer(name);
```

Starts and returns a reference to the named timer. The timer itself is not tied to any particular trace or span.

example:

```javascript
let timer = beeline.startTimer(operationName);
```

#### finishTimer()

```javascript
beeline.finishTimer(timer);
```

Computes duration (in millseconds) from `startTimer` call, and adds the field `${name}_ms` (with value the compute duration) to the current span.

#### withTimer()

```javascript
beeline.withTimer(name, fn);
```

Similar to `withTrace` and `withSpan`, `withTimer` is useful when you want to time a piece of synchronous code. The return value is the return vale of `fn`, so it can be used in expression contexts.

example:

```javascript
let sum = beeline.withTimer("sum", () => {
  let s = 0;
  for (let i of bigArray) {
    s += i;
  }
  return s;
});
// field "sum_ms" is added to the current span
```

#### schema

_[TODO more here, but it should be 99% of use to instrumentation authors, not beeline users]_

### Async context bookkeeping

The beeline uses nodejs's builtin `async_hooks` module to ensure its trace context is propagated through async calls, but there are some common patterns that break this magic (The most common is a worker/connection pool abstraction seen in many db packages).

#### bindFunctionToTrace()

```javascript
beeline.bindFunctionToTrace(fn);
```

Forces the function `fn` to be invoked with the trace context active when this call is executed.

example:

```javascript
myDBLibrary.query(
  "select * from table",
  beeline.bindFunctionToTrace(rows => {
    // inside this function the trace is guaranteed to be
    // the same as the the active trace when myDBLibrary.query
    // was called, even if some pattern in myDBLibrary causes
    // the context to be lost.
  })
);
```

#### runWithoutTrace()

```javascript
beeline.runWithoutTrace(fn);
```

Immediately executes fn _outside_ of the current trace if there is one. That is, clears the trace context only for the execution of fn, so fn runs without knowledge of the current trace.

This is less likely to be used outside of instrumentation than `bindFunctionToTrace`, but
can be useful if there are calls to instrumented libraries that you explicitly do not want to show up in your traces. For instance, the beeline uses this function so that the http POST the beeline makes to honeycomb's api is not included in the trace.

example

```javascript
// trace active at this point

beeline.runWithoutTrace(() => {
  // no trace is active within this function and within all async calls it makes.
});

// trace reinstated after the function is finished executing.
```

#### flush()

```javascript
beeline.flush();
```

Returns a `Promise` that will resolve when all finished spans have been acknowledged Honeycomb. any spans finished _after_ the flush call will not be waited on.

example

```javascript
beeline.finishTrace(trace);
// we've finished the trace, let's wait until all spans have been acknowledged
await beeline.flush();

// we're here, so everything has been sent.
process.exit(0);
```
