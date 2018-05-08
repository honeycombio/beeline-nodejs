# Custom Context Propagation

The builtin instrumentations will send context to honeycomb about the actual requests and queries, but they can't automatically capture all context that might be useful to you.

If there are additional fields you'd like to include in events, you can use the `customContext` interface to add them:

```
const honey = require("honeycomb-beeline")();

.
.
.

honey.customContext.add("extra", val);
```

This will cause an extra column (`app.extra`) to be added to your dataset, and the value you add will be sent along with all events within the current request that are generated after that line.

## Examples

in each of the examples below, the `customContext` usage is higlighted by a `/**/` comment in column 0.

### Using callbacks

```
const honey = require("honeycomb-beeline")();

const express = require("express"),
      React = require("react"),
      ReactDOM = require("react-dom/server"),
      User = require("./user"),
      UserView = require("./views/user);

app.param('user', (req, res, next, id) => {
    req.userId = id;
    next();
});

app.get("/user/:user, (req, res, next) => {
    // the underlying DB event called by User.find will _not_ contain the additional fields.
    User.find(req.userId, (err, user) => {
        if (err) {
            return next(err);
        }
/**/    honey.customContext.add("user.id", user.id);
/**/    honey.customContext.add("user.email", user.email);

        // the express request event will contain the additional fields.

        // the react renderToString event here will also contain the additional fields.
        res.send(ReactDOM.renderToString(React.createElement(UserView, { user })));
    })
});
```

### Using promises

```
const honey = require("honeycomb-beeline")();

const express = require("express"),
      React = require("react"),
      ReactDOM = require("react-dom/server"),
      User = require("./user"),
      UserView = require("./views/user);

app.param('user', (req, res, next, id) => {
    req.userId = id;
    next();
});

app.get("/user/:user, (req, res, next) => {
    // the underlying DB event called by User.find will _not_ contain the additional fields.
    User.find(req.userId).then(user => {
/**/    honey.customContext.add("user.id", user.id);
/**/    honey.customContext.add("user.email", user.email);

        // the express request event will contain the additional fields.

        // the react renderToString event here will also contain the additional fields.
        res.send(ReactDOM.renderToString(React.createElement(UserView, { user })));
    }).catch(err => {
        return next(err);
    })
});
```

### Using `async`/`await`

```
const honey = require("honeycomb-beeline")();

const express = require("express"),
      React = require("react"),
      ReactDOM = require("react-dom/server"),
      User = require("./user"),
      UserView = require("./views/user);

app.param('user', (req, res, next, id) => {
    req.userId = id;
    next();
});

app.get("/user/:user, async (req, res, next) => {
    try {
        // the underlying DB event called by User.find will _not_ contain the additional fields.
        let user = await User.find(req.userId);

/**/    honey.customContext.add("user.id", user.id);
/**/    honey.customContext.add("user.email", user.email);

        // the express request event will contain the additional fields.

        // the react renderToString event here will also contain the additional fields.
        res.send(ReactDOM.renderToString(React.createElement(UserView, { user })));
    } catch(e) {
        return next(e);
    }
});
```

### Doing the user lookup inside `app.param`

Each of the three examples above do the user lookup inside the request handler, but it's a more common pattern to do the lookup within the `app.param` callback itself.
Here's how it would look doing it that way with `async`/`await`.

```
const honey = require("honeycomb-beeline")();

const express = require("express"),
      React = require("react"),
      ReactDOM = require("react-dom/server"),
      User = require("./user"),
      UserView = require("./views/user);

app.param('user', async (req, res, next, id) => {
    try {
        let user = await User.find(id);
        if (!user) {
            next(new Error("No user found"));
            return;
        }
        req.user = user;
/**/    honey.customContext.add("user.id", user.id);
/**/    honey.customContext.add("user.email", user.email);
        next();
    } catch(e) {
        next(e);
    }
});

app.get("/user/:user, (req, res, next) => {
    // the express request event will still contain the additional fields.

    // the react renderToString event here will also contain the additional fields.
    res.send(ReactDOM.renderToString(React.createElement(UserView, { req.user })));
});
```
