# Honeycomb NodeJS Magic

An experimental onramp to getting your data into honeycomb as quickly as possible. With zero custom instrumentation required([1](#footnotes)).

# Full Magic

If you've got a nodejs `express` app, you can get request-level instrumentation of express and other packages you use by adding the following **before** `require`/`import`ing of other packages.:

```
require("honeycomb-nodejs-magic")(/* { ... optional configuration ... } */)
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

---

# Footnotes

1. For the currently limited set of supported packages, and only until you realize how powerful added custom instrumentation can make things :)
