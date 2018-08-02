# Honeycomb Beeline for NodeJS

[![Build Status](https://travis-ci.org/honeycombio/beeline-nodejs.svg?branch=master)](https://travis-ci.org/honeycombio/beeline-nodejs)

This package instruments your Express/NodeJS application for use with [Honeycomb](https://honeycomb.io). Slice and dice requests by endpoint, status, or even User ID, with zero custom instrumentation required([1](#footnotes)), and includes an [experimental API](#API) for filling in the holes in automatic instrumentation, or for adding service-specific custom instrumentation.

Requires Node 8+. Sign up for a [Honeycomb trial](https://ui.honeycomb.io/signup) to obtain a Write Key before starting.

# Installation (Quick)

If you've got a NodeJS `express` app, you can get request-level instrumentation of Express and other packages you use, magically.

Start by installing this package:

```bash
npm install --save honeycomb-beeline
```

And adding this to the top of your `app.js` **before** `require`/`import`ing of other packages:

```javascript
require("honeycomb-beeline")({
  writeKey: "YOUR-WRITE-KEY",
  /* ... additional optional configuration ... */
});
```

# Configuration

The `optional configuration` above allows configuring global settings (Honeycomb credentials and dataset name) as well as per-instrumentation settings:

```javascript
{
    writeKey: "/* your honeycomb write key, required */",
    dataset: "/* the name of the dataset you want to use (defaults to "nodejs") */"
    $instrumentationName: {
        /* instrumentation specific settings */
    }
}
```

Both `writeKey` and `dataset` can also be supplied in the environment, by setting `HONEYCOMB_WRITEKEY` and `HONEYCOMB_DATASET`, respectively.

For instrumentation settings, use the name of the instrumentation. For example, to add configuration options for `express`, your config object might look like:

```javascript
{
    writeKey: "1234567890asbcdef",
    dataset: "my-express-server",
    express: {
        /* express-specific settings */
    }
}
```

For available configuration options per instrumentation, see the [Automatically instrumented packages](#Automatically_instrumented_packages) section below.

# Example questions

* Which of my express app's endpoints are the slowest?

```
BREAKDOWN: request.url
CALCULATE: P99(duration_ms)
FILTER: meta.type == express
ORDER BY: P99(duration_ms) DESC
```

* Where's my app doing the most work / spending the most time?

```
BREAKDOWN: meta.type
CALCULATE: P99(duration_ms)
ORDER BY: P99(duration_ms) DESC
```

* Which users are using the endpoint that I'd like to deprecate?

```
BREAKDOWN: request.user.email
CALCULATE: COUNT
FILTER: request.url == <endpoint-url>
```

* Which XHR endpoints take the longest?

```
BREAKDOWN: request.url
CALCULATE: P99(duration_ms)
FILTER: meta.type == express AND request.xhr == true
ORDER BY: P99(duration_ms) DESC
```

# Example event

```javascript
{
  "Timestamp": "2018-03-20T00:47:25.339Z",
  "request.base_url": "",
  "request.fresh": false,
  "request.host": "localhost",
  "request.http_version": "HTTP/1.1",
  "request.remote_addr": "127.0.0.1",
  "request.method": "POST",
  "request.original_url": "/checkValid",
  "request.path": "/checkValid",
  "request.scheme": "http",
  "request.query": "{}",
  "request.secure": false,
  "request.url": "/checkValid",
  "request.xhr": true,
  "response.status_code": "200",
  "meta.instrumentation_count": 4,
  "meta.instrumentations": "[\"child_process\",\"express\",\"http\",\"https\"]",
  "meta.type": "express"
  "meta.version": "4.16.3",
  "meta.beeline_version": "1.0.2",
  "meta.node_version": "v9.10.0",
  "totals.mysql2.count": 2,
  "totals.mysql2.duration_ms": 13.291,
  "totals.mysql2.query.count": 2,
  "totals.mysql2.query.duration_ms": 13.291,
  "trace.trace_id": "11ad83a2-ca8d-4918-9db2-27524456d9f7",
  "trace.span_id": "4a3892ba-0936-46e1-8e17-31b887326027",
  "name": "request",
  "service_name": "express",
  "duration_ms": 15.229326,
}
```

# Automatically instrumented packages

The following is a list of packages we've added instrumentation for. Some actually add context to events, while others are only instrumented to enable
context propagation (mostly the `Promise`-like packages.)

## bluebird

Instrumented only for context propagation

## express

Adds columns with prefix `request.`

### Configuration options

| Name                  | Type                                                     |
| --------------------- | -------------------------------------------------------- |
| `express.userContext` | Array&lt;string&gt;\|Function&lt;(request) => Object&gt; |

#### `express.userContext`

If the value of this option is an array, it's assumed to be an array of string field names of `req.user`. If a request has `req.user`, the named fields are extracted and added to events with column names of `express.user.$fieldName`.

For example:

If `req.user` is an object `{ id: 1, username: "toshok" }` and your config settings include `express: { userContext: ["username"] }`, the following will be included in the express event sent to honeycomb:

| `request.user.username` |
| :---------------------- |
| `toshok`                |

If the value of this option is a function, it will be called on every request and passed the request as the sole argument. All key-values in the returned object will be added to the event. If the function returns a falsey value, no columns will be added. To replicate the above Array-based behavior, you could use the following config: `express: { userContext: (req) => req.user && { username: req.user.username } }`

This function isn't limited to using the request object, and can pull info from anywhere to enrich the data sent about the user.

## http

Adds columns with prefix `http.`

## https

Adds columns with prefix `https.`

## mongoose

Instrumented only for context propagation

## mongodb

Adds columns with prefix `db.`

### Configuration options

| Name                       | Type    |
| -------------------------- | ------- |
| `mongodb.includeDocuments` | boolean |

#### `mongodb.includeDocuments`

If true, documents in the api will be JSON serialized and included in the events sent to honeycomb.

## mpromise

Instrumented only for context propagation

## mysql2

Adds columns with prefix `db.`

## react-dom/server

Adds columns with prefix `react.`

## sequelize

Instrumented only for context propagation

(if you'd like to see anything more here, please file an issue or :+1: one already filed!)

# API

We're starting work on a public API for the beeline (reference in [docs/API.md](https://github.com/honeycombio/beeline-nodejs/blob/master/docs/API.md)). It should be considered experimental and subject to change (even in semver patch releases), but in practice we don't expect it to change in backward incompatible ways while we work on it. There will be a final version bump when the API is considered "done" when we'll make all the breaking changes. We value your feedback, so if you find anything confusing or suboptimal or at all unclear, let us know!

# Adding additional context

See [docs/CustomContext.md](https://github.com/honeycombio/beeline-nodejs/blob/master/docs/CustomContext.md)

# Troubleshooting

Use the `DEBUG=honeycomb-beeline:*` environment variable to produce debug output.

---

# Footnotes

1.  For the currently limited set of supported packages, and only until you realize how powerful added custom instrumentation can make things :)
