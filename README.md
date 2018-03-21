# Honeycomb NodeJS Magic

An experimental onramp to getting your data into [Honeycomb](https://honeycomb.io) as quickly as possible. With zero custom instrumentation required([1](#footnotes)).

Requires Node 6+?

# Full Magic

If you've got a nodejs `express` app, you can get request-level instrumentation of express and other packages you use, magically.

Start by installing this package:
```bash
npm install --save honeycomb-nodejs-magic
```

And adding this to the top of your `app.js` **before** `require`/`import`ing of other packages:

```javascript
require("honeycomb-nodejs-magic")({ writeKey: "YOUR-WRITE-KEY" /* , ... additional optional configuration ... */ })
```

# Configuration

The `optional configuration` above allows configuring global (honeycomb credentials and dataset) as well as per-instrumentation settings:

```
{
    writeKey: "/* your honeycomb write key */",
    dataset: "/* the name of the dataset you want to use */"
    $instrumentationName: {
        /* instrumentation specific settings */
    }
}
```

Both `writeKey` and `dataset` can also be supplied in the environment, by setting `HONEYCOMB_WRITEKEY` and `HONEYCOMB_DATASET`, respectively.

For instrumentation settings, use the name of the instrumentation. For example, to add configuration options for `express`, your config object might look like:

```
{
    writeKey: "1234567890asbcdef",
    dataset: "my-express-server",
    express: {
        /* express-specific settings */
    }
}
```

For available configuration options per instrumentation, see the instrumentation sections below.

# Instrumented packages

The following is a list of packages we've added instrumentation for. Some actually add context to events, while others are only instrumented to enable
context propagation (mostly the `Promise`-like packages.)

## bluebird

Instrumented only for context propagation

## express

Adds columns with prefix `express.`

### Configuration options

| Name                  | Type                                                     |
| --------------------- | -------------------------------------------------------- |
| `express.userContext` | Array&lt;string&gt;\|Function&lt;(request) => Object&gt; |

#### `express.userContext`

If the value of this option is an array, it's assumed to be an array of string field names of `req.user`. If a request has `req.user`, the named fields are extracted and added to events with column names of `express.user.$fieldName`.

For example:

If `req.user` is an object `{ id: 1, username: "toshok" }` and your config settings include `express: { userContext: ["username"] }`, the following will be included in the express event sent to honeycomb:

| `express.user.username` |
| :---------------------- |
| `toshok`                |

If the value of this option is a function, it will be called on every request and passed the request as the sole argument. All key-values in the returned object will be added to the event. If the function returns a falsey value, no columns will be added. To replicate the above Array-based behavior, you could use the following config: `express: { userContext: (req) => req.user && { username: req.user.username } }`

This function isn't limited to using the request object, and can pull info from anywhere to enrich the data sent about the user.

## http

Adds columns with prefix `http.`

## https

Adds columns with prefix `https.`

## mpromise

Instrumented only for context propagation

## mysql2

Adds columns with prefix `mysql2.`

## react-dom/server

Adds columns with prefix `react.`

## sequelize

Instrumented only for context propagation

(if you'd like to see anything more here, please file an issue or :+1: one already filed!)

# Adding additional context

The package instrumentations will send context to honeycomb about the actual requests and queries, but they can't automatically capture all context that you might want.
If there's additional fields you'd like to include in events, you can use the `customContext` interface:

```
var honeyMagic = require("honeycomb-nodejs-magic")();

.
.
.

honeyMagic.customContext.add("extra", val);
```

This will cause an extra column (`custom.extra`) to be added to your dataset.

# Troubleshooting

Use the `DEBUG=honeycomb-magic:*` environment variable to produce debug output.

# Example questions

- Which endpoints on my app are the slowest?
- Where is my app doing the most work / spending the most time?

TODO: edit for clarity :)

# Example event

```javascript
{
  "Timestamp": "2018-03-20T00:47:25.339Z",
  "express.baseUrl": "",
  "express.fresh": false,
  "express.hostname": "localhost",
  "express.http_version": "1.1",
  "express.ip": "127.0.0.1",
  "express.method": "POST",
  "express.originalUrl": "/checkValid",
  "express.path": "/checkValid",
  "express.protocol": "http",
  "express.query": "{}",
  "express.response_time_ms": 15.229326,
  "express.secure": false,
  "express.status_code": "200",
  "express.url": "/checkValid",
  "express.xhr": true,
  "meta.instrumentation_count": 4,
  "meta.instrumentations": "[\"child_process\",\"express\",\"http\",\"https\"]",
  "meta.request_id": "11ad83a2-ca8d-4918-9db2-27524456d9f7",
  "meta.type": "express"
}
```

---

# Footnotes

1. For the currently limited set of supported packages, and only until you realize how powerful added custom instrumentation can make things :)
