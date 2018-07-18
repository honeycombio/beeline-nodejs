/* eslint-env node, jest */
const http = require("http"),
  instrumentHttp = require("./http"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  event = require("../event");

instrumentHttp(http);

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
    expect(event.apiForTesting().sentEvents).toMatchObject([
      {
        [schema.EVENT_TYPE]: "http",
        [schema.TRACE_SPAN_NAME]: "request",
        url: "http://localhost:9009",
      },
    ]);
    done();
  });
});
