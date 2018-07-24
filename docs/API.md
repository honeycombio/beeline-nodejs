# Public API

The beeline does a lot of magic for you, but there will probably be parts of your application where you'll want to add
some additional instrumentation. There might also be problems with async context propagation that you'll need to work
around while waiting for a bug fix. We now have a public API for you to use that addresses both those use-cases. It'll
also help if you want write a custom instrumentation for your favorite npm package :)

## Accessing the API

Everything in this document is available off the module you import:

```javascript
const beeline = require("honeycomb-beeline")();

/* beeline.traceActive() works, as do all the other calls below */
```

There are a few surfaces to the API:

1.  Traces and spans
2.  Interprocess trace propagation
3.  Adding context to spans, including timers
4.  Dealing with async context propagation

### Creating traces and spans

#### startTrace()

```javascript
beeline.startTrace(metadataContext[, withTraceId, withParentSpanId])
```

Starts a new local trace and initializes the async context propagation machinery. Most other API calls require
a trace to be active to actually do anything (i.e. calling `startSpan` does nothing if there's no trace.) Returns
a reference to the trace, and installs the root span as the current span.

`metadataContext` is a map of initial properties of the root span.

For an explanation of `withTraceId` and `withParentSpanId`, see "Interprocess trace propagation" below.

example:

```javascript
let trace = beeline.startTrace({
  field1: value1,
  field2: value2,
});
```

#### finishTrace()

```javascript
beeline.finishTrace(trace);
```

Sends the trace's root span, and tears down the async context propagation machinery. This _must_ be called in order
to send the root span.

example:

```javascript
let trace = beeline.startTrace({
  task: "writing a file",
  filePath,
});
fs.writeFile(filePath, fileContents, err => {
  beeline.finishTrace(trace);
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

let fib = beeline.withTrace(
  {
    task: "computing fibonacci number",
    n,
  },
  () => computeFib(n)
);
console.log(`The answer is ${fib}.`);
```

#### startSpan()

```javascript
beeline.startSpan(metadataContext);
```

Starts a new span within an existing trace. This new span is added as a child of the current span, and recorded as the current span.

example:

```javascript
let span = beeline.startSpan({
  task: "writing a file",
  filePath,
});
fs.writeFile(filePath, fileContents, err => {
  beeline.finishSpan(trace);
});

let span1 = beeline.startSpan({
  name: "parent span",
});
```

#### finishSpan()

```javascript
beeline.finishSpan(span);
```

#### withSpan()

### Interprocess trace propagation

If you're dealing with multiple services (either on the same host or different ones) and want the services to all participate in the same trace, some information about the trace itself needs to be propagated on outbound calls (and then consumed on the other side.) For outbound http/https and inbound express, the propagation happens automatically. The following APIs exist to ease the task of adding propagation to other transports.

#### marshalTraceContext()

```javascript
beeline.marshalTraceContext();
```

Returns a serialized form of the current trace context (including the trace id and the current span), encoded as a string. The format is documented at https://github.com/honeycombio/beeline-nodejs/blob/master/lib/propagation.js#L16

example:

```javascript
let traceContext = beeline.marshalTraceContext();
console.log(traceContext); // => 1;trace_id=weofijwoeifj,parent_id=owefjoweifj,context=SGVsbG8gV29ybGQ=
```

#### unmarshalTraceContext()

```javascript
beeline.unmarshalTraceContext(traceContext);
```

Returns an object containing the properties `traceId` and `parentSpanId`, which are the two optional parameters with `startTrace()` above.

example:

```javascript
let { traceId, parentSpanId } = beeline.unmarshalTraceContext();

let trace = startTrace({ name }, traceId, parentSpanId);
```

#### TRACE_HTTP_HEADER

The HTTP header that the beeline uses both for sending and receiving trace context. The value is `"X-Honeycomb-Trace"`.

#### How to use it? An example

Imagine two services written in Javascript using a bespoke RPC transport, with service1 making a call to service2.

service1:

```javascript
  // assuming we're in a trace already, having been started with startTrace()
  // directly, or because we're in an express handler.
  let traceContext = beeline.marshalTraceContext();
  await service2Client.doSomething({
    // add the traceContext in our RPC call payload
    traceContext,
    arg1: val1,
    arg2: val2,
  })
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

####

### Adding context

#### addContext()

#### removeContext()

#### customContext.add()

#### customContext.remove()

#### schema

### Async Context Bookkeeping

#### bindFunctionToTrace()

#### runWithoutTrace()
