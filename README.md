# Honeycomb NodeJS Magic

An experimental onramp to getting your data into honeycomb as quickly as possible.  With zero custom instrumentation required([1](#footnotes).

# Full Magic

If you've got a nodejs `express` app, you can get request-level instrumentation of express and other packages you use by adding:

```
require("honeycomb-nodejs-magic")({
    writeKey: "/* your honeycomb write key */",
    dataset: "/* the name of the dataset you want to use */"
})
```

Both `writeKey` and `dataset` can also be supplied in the environment, by setting `HONEYCOMB_WRITEKEY` and `HONEYCOMB_DATASET`, respectively.  If they're
both specified in the environment, the required change to your code is even smaller:

```
require("honeycomb-nodejs-magic")();
```

This line _has_ to come before any `require`/`import` for packages that you might want instrumented.

# Instrumented packages

The following is a list of packages we've added instrumentation for.  Some actually add context to events, while others are only instrumented to enable
context propagation (mostly the `Promise`-like packages.)

* bluebird - instrumented only for context propagation
* express - adds columns with prefix `express/`
* http - adds columns with prefix `http/`
* https - adds columns with prefix `http/`
* mpromise - instrumented only for context propagation
* mysql2 - adds columns with prefix `mysql/`
* react-dom/server - adds columns with prefix `react-dom/`
* sequelize - instrumented only for context propagation

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

This will cause an extra column (`custom/extra`) to be added to your dataset.

---

# Footnotes

1. For the currently limited set of supported packages.