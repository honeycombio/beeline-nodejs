/* eslint-env node, jest */
const request = require("supertest"),
  path = require("path"),
  http = require("http"),
  net = require("net"),
  instrumentExpress = require("./express"),
  cases = require("jest-in-case"),
  schema = require("../schema"),
  api = require("../api"),
  tracker = require("../async_tracker"),
  hooks = require("../propagation/hooks"),
  pkg = require(path.join(__dirname, "..", "..", "package.json"));

describe("userContext", () => {
  function runCase(opts, done) {
    const express = instrumentExpress(require("express"), opts);

    let app;
    function initializeTestApp() {
      app = express();
      app.get("/", function (req, res) {
        /* add a user */
        req.user = {
          id: 42,
          username: "toshok",
        };
        res.status(200).send("ok");
      });
    }

    api.configure({ impl: "mock" });
    initializeTestApp();

    expect(express.__wrapped).toBe(true);
    request(app)
      .get("/")
      .expect(200, () => {
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev).toEqual(
          expect.objectContaining({
            [schema.TRACE_ID]: 0,
            [schema.TRACE_ID_SOURCE]: undefined,
            [schema.TRACE_SPAN_NAME]: "request",
            [schema.EVENT_TYPE]: "express",
            [schema.PACKAGE_VERSION]: "1.1.1",
            [schema.DURATION_MS]: 0,
            [schema.BEELINE_VERSION]: pkg.version,
            "request.host": "127.0.0.1",
            "request.base_url": "",
            "request.route": "/",
            "request.original_url": "/",
            "request.remote_addr": "::ffff:127.0.0.1",
            "request.secure": false,
            "request.method": "GET",
            "request.scheme": "http",
            "request.path": "/",
            "request.query": {},
            "request.http_version": "HTTP/1.1",
            "request.fresh": false,
            "request.xhr": false,
            "request.user.id": 42,
            "request.user.username": "toshok",
            "response.status_code": "200",
          })
        );
        api._resetForTesting();
        done();
      });
  }

  cases("cases", (opts, done) => runCase(opts, done), [
    {
      name: "field array userContext",
      userContext: ["id", "username"],
      packageVersion: "1.1.1",
    },

    {
      description: "function userContext",
      userContext: (req) => ({ id: req.user.id, username: req.user.username }),
      packageVersion: "1.1.1",
    },
  ]);
});

describe("userContext as function", () => {
  let cb_called = false;

  const express = instrumentExpress(require("express"), {
    userContext: () => {
      cb_called = true;
      return { random: "stuff" };
    },
  });

  let app;
  function initializeTestApp() {
    app = express();
    app.get("/", function (req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });
  }

  beforeEach(() => {
    api.configure({ impl: "mock" });
    initializeTestApp();
  });
  afterEach(() => {
    api._resetForTesting();
  });

  test("it's called even if req.user is undefined", (done) => {
    request(app)
      .get("/")
      .expect(200, () => {
        expect(cb_called).toBe(true);
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev["request.user.random"]).toBe("stuff");
        done();
      });
  });
});

describe("req properties should only be read after a request matches a route", () => {
  const express = instrumentExpress(require("express"), {});

  let app;
  function initializeTestApp() {
    app = express();
    let router = express.Router();
    app.get("/:name", function (req, res) {
      res.status(200).send("ok");
    });

    router.get("/router/:name", function (req, res) {
      res.status(200).send("ok");
    });

    app.use("/base", router);
  }

  beforeEach(() => {
    api.configure({ impl: "mock" });
    initializeTestApp();
  });
  afterEach(() => {
    api._resetForTesting();
  });

  test("it correctly sends the matched path", (done) => {
    request(app)
      .get("/mordy")
      .expect(200, () => {
        setTimeout(() => {
          expect(api._apiForTesting().sentEvents.length).toBe(1);
          let ev = api._apiForTesting().sentEvents[0];
          expect(ev["request.route"]).toBe("/:name");
          done();
        }, 1000);
      });
  });

  test("it correctly sends the matched base_url", (done) => {
    request(app)
      .get("/base/router/mordy")
      .expect(200, () => {
        setTimeout(() => {
          expect(api._apiForTesting().sentEvents.length).toBe(1);
          let ev = api._apiForTesting().sentEvents[0];
          expect(ev["request.base_url"]).toBe("/base");
          done();
        }, 1000);
      });
  });
});

describe("request id from x-request-id http header", () => {
  const express = instrumentExpress(require("express"), {
    traceIdSource: api.REQUEST_ID_HTTP_HEADER,
  });

  let app;
  function initializeTestApp() {
    app = express();
    app.get("/", function (req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });
  }

  beforeEach(() => {
    api.configure({ impl: "mock" });
    initializeTestApp();
  });
  afterEach(() => {
    api._resetForTesting();
  });

  test("X-Request-ID works", (done) => {
    request(app)
      .get("/")
      .set("X-Request-ID", "abc123")
      .expect(200, () => {
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("abc123");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("X-Request-ID http header");
        done();
      });
  });
});

describe("Trace ids from X-Amzn-trace-id header", () => {
  const express = instrumentExpress(require("express"), {
    traceIdSource: api.AMAZON_TRACE_HTTP_HEADER,
  });

  let app;
  function initializeTestApp() {
    app = express();
    app.get("/", function (req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });
  }

  beforeEach(() => {
    api.configure({ impl: "mock" });
    initializeTestApp();
  });
  afterEach(() => {
    api._resetForTesting();
  });

  test("X-Amzn-Trace-Id works", (done) => {
    request(app)
      .get("/")
      .set("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678")
      .expect(200, () => {
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("1-67891233-abcdef012345678912345678");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("X-Amzn-Trace-Id http header");
        done();
      });
  });
});

describe("Trace ids from X-Request-ID and X-Amzn-trace-id headers", () => {
  const express = instrumentExpress(require("express"), {
    traceIdSource: api.REQUEST_ID_HTTP_HEADER,
  });

  let app;
  function initializeTestApp() {
    app = express();
    app.get("/", function (req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });
  }

  beforeEach(() => {
    api.configure({ impl: "mock" });
    initializeTestApp();
  });
  afterEach(() => {
    api._resetForTesting();
  });

  test("X-Request-ID > X-Amzn-Trace-Id", (done) => {
    request(app)
      .get("/")
      .set("X-Request-ID", "abc123")
      .set("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678")
      .expect(200, () => {
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("abc123");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("X-Request-ID http header");
        done();
      });
  });
});

describe("trace parser hook", () => {
  const express = instrumentExpress(require("express"));

  let app;

  function initializeTestApp() {
    app = express();
    app.get("/", function (req, res) {
      res.status(200).send("ok");
    });
  }

  beforeEach(() => {
    api.configure({ impl: "mock" });
    hooks.configure({
      httpTraceParserHook: () => {
        return { traceId: "my-special-trace" };
      },
    });
    initializeTestApp();
  });
  afterEach(() => {
    api._resetForTesting();
    hooks.configure({});
  });

  test("honors the hook configuration over default parsing", (done) => {
    request(app)
      .get("/")
      .set("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678")
      .expect(200, () => {
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("my-special-trace");
        done();
      });
  });
});

describe("trace id callback", () => {
  const express = instrumentExpress(require("express"), {
    traceIdSource: (req) => req.get("X-Request-ID") || "efgh456",
  });

  let app;

  function initializeTestApp() {
    app = express();
    app.get("/", function (req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });
  }

  beforeEach(() => {
    api.configure({ impl: "mock" });
    initializeTestApp();
  });
  afterEach(() => {
    api._resetForTesting();
  });

  test("returns supplied X-Request-Id (calling the traceIdSource function)", (done) => {
    request(app)
      .get("/")
      .set("X-Request-ID", "abc123")
      .expect(200, () => {
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("abc123");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("traceIdSource function");
        done();
      });
  });

  test("returns static value if header isn't supplied", (done) => {
    request(app)
      .get("/")
      .expect(200, () => {
        expect(api._apiForTesting().sentEvents.length).toBe(1);
        let ev = api._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("efgh456");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("traceIdSource function");
        done();
      });
  });
});

describe("tracking loss detection", () => {
  const express = instrumentExpress(require("express"), {
    debugWrapMiddleware: true,
  });

  let askForIssue;
  beforeAll(() => {
    api.configure({ impl: "mock" });
    askForIssue = api._askForIssue;
  });
  afterAll(() => {
    api._resetForTesting();
    api._askForIssue = askForIssue;
  });

  let testRequest, testResponse;
  let app;
  let mockAsk;
  beforeEach(() => {
    app = express();
    mockAsk = api._askForIssue = jest.fn();
    testRequest = new http.IncomingMessage(new net.Socket());
    testRequest.url = "/test/route";
    testRequest.method = "GET";

    testResponse = new http.ServerResponse(testRequest);
  });
  test("we detect it in normal middleware next callback", (done) => {
    app.use((req, res, next) => {
      // we simulate an async operation that loses context by explicitly losing it before calling next.
      tracker.setTracked(undefined);
      next();
    });

    app.use((_req, _res, next) => {
      expect(mockAsk.mock.calls.length).toBe(1);
      expect(mockAsk.mock.calls[0][0]).toMatch(/we lost our tracking/);
      next();
    });

    app.handle(testRequest, testResponse, done);
  });

  test("we detect it in error middleware next callback", (done) => {
    app.use(() => {
      // generate an error
      throw new Error("something bad happened here");
    });

    app.use((err, _req, _res, next) => {
      // we simulate an async operation that loses context by explicitly losing it before calling err.
      tracker.setTracked(undefined);
      next(err);
    });

    app.use((err, _req, _res, next) => {
      expect(mockAsk.mock.calls.length).toBe(1);
      expect(mockAsk.mock.calls[0][0]).toMatch(/we lost our tracking/);
      next();
    });

    app.handle(testRequest, testResponse, done);
  });
});
