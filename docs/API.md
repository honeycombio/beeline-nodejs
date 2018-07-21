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

#### finishSpan()

#### withSpan()

### Interprocess trace propagation

#### marshalTraceContext()

#### unmarshalTraceContext()

#### TRACE_HTTP_HEADER

### Adding context

#### addContext()

#### removeContext()

#### customContext.add()

#### customContext.remove()

#### schema

### Async Context Bookkeeping

#### bindFunctionToTrace()

#### runWithoutTrace()
