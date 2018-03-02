/* global require expect test beforeAll afterAll */
const request = require("supertest"),
  instrumentExpress = require("./express-magic"),
  event = require("../event");

const express = instrumentExpress(require("express"));

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

beforeAll(() => {
  event.configure({ api: "mock" });
  initializeTestServer();
});
afterAll(() => server.close());

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
