const https = require("https");
(instrumentHttps = require("./https-magic")),
  (tracker = require("../async_tracker")),
  (event = require("../event"));

jest.mock("../event");

instrumentHttps(https);

// XXX(toshok) we need to start an http server so we can work without net access.

test("GET https://google.com works", done => {
  let context = {};
  tracker.setTracked(context);

  https.get("https://google.com", res => {
    expect(tracker.getTracked()).toBe(context);
    expect(event.sentEvents.length).toBe(1);
    expect(event.sentEvents[0].type).toBe("https");
    expect(event.sentEvents[0].appEventPrefix).toBe("request");
    done();
  });
});
