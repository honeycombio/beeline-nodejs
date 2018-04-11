/* global require expect describe test beforeEach afterEach */
const request = require("supertest"),
  instrumentExpress = require("./express-magic"),
  schema = require("../schema"),
  event = require("../event");

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
      event.resetForTesting();
      server.close();
    });

    test("sanity check", done => {
      expect(express.__wrapped).toBe(true);
      request(server)
        .get("/")
        .expect(200, () => {
          expect(event.apiForTesting().sentEvents.length).toBe(1);
          let ev = event.apiForTesting().sentEvents[0];
          expect(ev.startTime).not.toBeUndefined();
          expect(ev.startTimeHR).not.toBeUndefined();
          delete ev.startTime;
          delete ev.startTimeHR;
          expect(ev).toEqual({
            [schema.REQUEST_ID]: 0,
            [schema.EVENT_TYPE]: "express",
            [schema.PACKAGE_VERSION]: "1.1.1",
            [schema.DURATION_MS]: 0,
            hostname: "127.0.0.1",
            baseUrl: "",
            url: "/",
            route: undefined,
            originalUrl: "/",
            ip: "::ffff:127.0.0.1",
            secure: false,
            method: "GET",
            protocol: "http",
            path: "/",
            query: {},
            httpVersion: "1.1",
            fresh: false,
            xhr: false,
            "user.id": 42,
            "user.username": "toshok",
            statusCode: "200",
            appEventPrefix: null,
          });
          event.apiForTesting().sentEvents.splice(0, 1);
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
    event.resetForTesting();
    server.close();
  });

  test("it's called even if req.user is undefined", done => {
    request(server)
      .get("/")
      .expect(200, () => {
        expect(cb_called).toBe(true);
        expect(event.apiForTesting().sentEvents.length).toBe(1);
        let ev = event.apiForTesting().sentEvents[0];
        expect(ev["user.random"]).toBe("stuff");
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
    event.resetForTesting();
    server.close();
  });

  test("X-Request-ID works", done => {
    request(server)
      .get("/")
      .set("X-Request-ID", "abc123")
      .expect(200, () => {
        expect(event.apiForTesting().sentEvents.length).toBe(1);
        let ev = event.apiForTesting().sentEvents[0];
        expect(ev[schema.REQUEST_ID]).toBe("abc123");
        expect(ev[schema.REQUEST_ID_SOURCE]).toBe("X-Request-ID http header");
        done();
      });
  });

  test("X-Amzn-Trace-Id works", done => {
    request(server)
      .get("/")
      .set("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678")
      .expect(200, () => {
        expect(event.apiForTesting().sentEvents.length).toBe(1);
        let ev = event.apiForTesting().sentEvents[0];
        expect(ev[schema.REQUEST_ID]).toBe("Root=1-67891233-abcdef012345678912345678");
        expect(ev[schema.REQUEST_ID_SOURCE]).toBe("X-Amzn-Trace-Id http header");
        done();
      });
  });

  test("X-Request-ID > X-Amzn-Trace-Id", done => {
    request(server)
      .get("/")
      .set("X-Request-ID", "abc123")
      .set("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678")
      .expect(200, () => {
        expect(event.apiForTesting().sentEvents.length).toBe(1);
        let ev = event.apiForTesting().sentEvents[0];
        expect(ev[schema.REQUEST_ID]).toBe("abc123");
        expect(ev[schema.REQUEST_ID_SOURCE]).toBe("X-Request-ID http header");
        done();
      });
  });
});

describe("request id callback", () => {
  const express = instrumentExpress(require("express"), {
    requestIdSource: req => req.get("X-Request-ID") || "efgh456",
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
    event.resetForTesting();
    server.close();
  });

  test("returns supplied X-Request-Id (calling the requestIdSource function)", done => {
    request(server)
      .get("/")
      .set("X-Request-ID", "abc123")
      .expect(200, () => {
        expect(event.apiForTesting().sentEvents.length).toBe(1);
        let ev = event.apiForTesting().sentEvents[0];
        expect(ev[schema.REQUEST_ID]).toBe("abc123");
        expect(ev[schema.REQUEST_ID_SOURCE]).toBe("requestIdSource function");
        done();
      });
  });

  test("returns static value if header isn't supplied", done => {
    request(server)
      .get("/")
      .expect(200, () => {
        expect(event.apiForTesting().sentEvents.length).toBe(1);
        let ev = event.apiForTesting().sentEvents[0];
        expect(ev[schema.REQUEST_ID]).toBe("efgh456");
        expect(ev[schema.REQUEST_ID_SOURCE]).toBe("requestIdSource function");
        done();
      });
  });
});
