const http = require("http");
(instrumentHttp = require("./http-magic")),
  (tracker = require("../async_tracker")),
  (event = require("../event"));

jest.mock("../event");

instrumentHttp(http);

// XXX(toshok) we need to start an http server so we can work without net access.

test("GET http://google.com works", done => {
  let context = {};
  tracker.setTracked(context);

  http.get("http://google.com", res => {
    expect(tracker.getTracked()).toBe(context);
    expect(event.sentEvents.length).toBe(1);
    expect(event.sentEvents[0].type).toBe("http");
    expect(event.sentEvents[0].appEventPrefix).toBe("request");
    done();
  });
});
