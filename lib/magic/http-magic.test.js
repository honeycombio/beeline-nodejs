const http = require("http");
(instrumentHttp = require("./http-magic")),
  (tracker = require("../async_tracker")),
  (event = require("../event"));

jest.mock("../event");

instrumentHttp(http);

let server;
beforeAll(() => {
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

  http.get("http://localhost:9009", res => {
    expect(tracker.getTracked()).toBe(context);
    expect(event.sentEvents.length).toBe(1);
    expect(event.sentEvents[0].type).toBe("http");
    expect(event.sentEvents[0].appEventPrefix).toBe("request");
    done();
  });
});
