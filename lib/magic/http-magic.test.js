/* global require expect test beforeAll afterAll */
const http = require("http"),
  instrumentHttp = require("./http-magic"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  event = require("../event");

instrumentHttp(http, {});

let server;
beforeAll(() => {
  event.configure({ api: "mock" });

  server = http.createServer((req, res) => {
    res.end();
  });

  server.listen(9009, "localhost");
});
afterAll(() => {
  server.close();
  server = null;
});

test("GET http://localhost:9009/ works", done => {
  let context = {};
  tracker.setTracked(context);

  http.get("http://localhost:9009", _res => {
    expect(tracker.getTracked()).toBe(context);
    expect(event.apiForTesting().sentEvents.length).toBe(1);
    expect(event.apiForTesting().sentEvents[0][schema.EVENT_TYPE]).toBe("http");
    expect(event.apiForTesting().sentEvents[0].appEventPrefix).toBe("request");
    expect(event.apiForTesting().sentEvents[0].url).toBe("http://localhost:9009");
    done();
  });
});
