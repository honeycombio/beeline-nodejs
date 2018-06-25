/* eslint-env node, jest */
const request = require("supertest"),
  path = require("path"),
  instrumentExpress = require("./express"),
  schema = require("../schema"),
  event = require("../event_api"),
  pkg = require(path.join(__dirname, "..", "..", "package.json"));

const tests = [
  {
    description: "field array userContext",
    opts: { userContext: ["id", "username"], packageVersion: "1.1.1" },
  },
  {
    description: "function userContext",
    opts: {
      userContext: req => ({ id: req.user.id, username: req.user.username }),
      packageVersion: "1.1.1",
    },
  },
];

for (let t of tests) {
  describe(t.description, () => {
    const express = instrumentExpress(require("express"), t.opts);

    let server;
    function initializeTestServer() {
      let app = express();
      app.get("/", function(req, res) {
        /* add a user */
        req.user = {
          id: 42,
          username: "toshok",
        };
        res.status(200).send("ok");
      });

      server = app.listen(3000);
    }

    beforeEach(() => {
      event.configure({ api: "mock" });
      initializeTestServer();
    });
    afterEach(() => {
      event._resetForTesting();
      server.close();
    });

    test("sanity check", done => {
      expect(express.__wrapped).toBe(true);
      request(server)
        .get("/")
        .expect(200, () => {
          expect(event._apiForTesting().sentEvents.length).toBe(1);
          let ev = event._apiForTesting().sentEvents[0];
          expect(ev.startTime).not.toBeUndefined();
          expect(ev.startTimeHR).not.toBeUndefined();
          delete ev.startTime;
          delete ev.startTimeHR;
          expect(ev).toEqual({
            [schema.TRACE_ID]: 0,
            [schema.TRACE_ID_SOURCE]: undefined,
            [schema.TRACE_SPAN_NAME]: "request",
            [schema.EVENT_TYPE]: "express",
            [schema.PACKAGE_VERSION]: "1.1.1",
            [schema.DURATION_MS]: 0,
            [schema.BEELINE_VERSION]: pkg.version,
            "request.host": "127.0.0.1",
            "request.base_url": "",
            "request.route": undefined,
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
          });
          event._apiForTesting().sentEvents.splice(0, 1);
          done();
        });
    });
  });
}

describe("userContext as function", () => {
  let cb_called = false;

  const express = instrumentExpress(require("express"), {
    userContext: () => {
      cb_called = true;
      return { random: "stuff" };
    },
  });

  let server;
  function initializeTestServer() {
    let app = express();
    app.get("/", function(req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });

    server = app.listen(3000);
  }

  beforeEach(() => {
    event.configure({ api: "mock" });
    initializeTestServer();
  });
  afterEach(() => {
    event._resetForTesting();
    server.close();
  });

  test("it's called even if req.user is undefined", done => {
    request(server)
      .get("/")
      .expect(200, () => {
        expect(cb_called).toBe(true);
        expect(event._apiForTesting().sentEvents.length).toBe(1);
        let ev = event._apiForTesting().sentEvents[0];
        expect(ev["request.user.random"]).toBe("stuff");
        done();
      });
  });
});

describe("request id from http headers", () => {
  const express = instrumentExpress(require("express"), {});

  let server;
  function initializeTestServer() {
    let app = express();
    app.get("/", function(req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });

    server = app.listen(3000);
  }

  beforeEach(() => {
    event.configure({ api: "mock" });
    initializeTestServer();
  });
  afterEach(() => {
    event._resetForTesting();
    server.close();
  });

  test("X-Request-ID works", done => {
    request(server)
      .get("/")
      .set("X-Request-ID", "abc123")
      .expect(200, () => {
        expect(event._apiForTesting().sentEvents.length).toBe(1);
        let ev = event._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("abc123");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("X-Request-ID http header");
        done();
      });
  });

  test("X-Amzn-Trace-Id works", done => {
    request(server)
      .get("/")
      .set("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678")
      .expect(200, () => {
        expect(event._apiForTesting().sentEvents.length).toBe(1);
        let ev = event._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("Root=1-67891233-abcdef012345678912345678");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("X-Amzn-Trace-Id http header");
        done();
      });
  });

  test("X-Request-ID > X-Amzn-Trace-Id", done => {
    request(server)
      .get("/")
      .set("X-Request-ID", "abc123")
      .set("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678")
      .expect(200, () => {
        expect(event._apiForTesting().sentEvents.length).toBe(1);
        let ev = event._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("abc123");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("X-Request-ID http header");
        done();
      });
  });
});

describe("trace id callback", () => {
  const express = instrumentExpress(require("express"), {
    traceIdSource: req => req.get("X-Request-ID") || "efgh456",
  });

  let server;
  function initializeTestServer() {
    let app = express();
    app.get("/", function(req, res) {
      // don't add req.user here
      res.status(200).send("ok");
    });

    server = app.listen(3000);
  }

  beforeEach(() => {
    event.configure({ api: "mock" });
    initializeTestServer();
  });
  afterEach(() => {
    event._resetForTesting();
    server.close();
  });

  test("returns supplied X-Request-Id (calling the traceIdSource function)", done => {
    request(server)
      .get("/")
      .set("X-Request-ID", "abc123")
      .expect(200, () => {
        expect(event._apiForTesting().sentEvents.length).toBe(1);
        let ev = event._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("abc123");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("traceIdSource function");
        done();
      });
  });

  test("returns static value if header isn't supplied", done => {
    request(server)
      .get("/")
      .expect(200, () => {
        expect(event._apiForTesting().sentEvents.length).toBe(1);
        let ev = event._apiForTesting().sentEvents[0];
        expect(ev[schema.TRACE_ID]).toBe("efgh456");
        expect(ev[schema.TRACE_ID_SOURCE]).toBe("traceIdSource function");
        done();
      });
  });
});
