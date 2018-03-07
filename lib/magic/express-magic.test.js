/* global require expect describe test beforeEach afterEach */
const request = require("supertest"),
  instrumentExpress = require("./express-magic"),
  event = require("../event");

const tests = [
  { description: "field array userContext", opts: { userContext: ["id", "username"] } },
  {
    description: "function userContext",
    opts: { userContext: req => ({ id: req.user.id, username: req.user.username }) },
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
            "meta.request_id": 0,
            "meta.type": "express",
            "express.hostname": "127.0.0.1",
            "express.baseUrl": "",
            "express.url": "/",
            "express.route": undefined,
            "express.originalUrl": "/",
            "express.ip": "::ffff:127.0.0.1",
            "express.secure": false,
            "express.method": "GET",
            "express.protocol": "http",
            "express.path": "/",
            "express.query": {},
            "express.http_version": "1.1",
            "express.fresh": false,
            "express.xhr": false,
            "express.user.id": 42,
            "express.user.username": "toshok",
            "express.status_code": "200",
            appEventPrefix: null,
            "express.response_time_ms": 0,
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
        expect(ev["express.user.random"]).toBe("stuff");
        done();
      });
  });
});
