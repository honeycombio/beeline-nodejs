/* global require jest expect test */
const https = require("https"),
  instrumentHttps = require("./https-magic"),
  tracker = require("../async_tracker"),
  event = require("../event");

jest.mock("../event");

instrumentHttps(https);

// XXX(toshok) we need to start an https server so we can work without net access.
// transliterating http-magic.test.js to https doesn't seem to work.

test("GET https://google.com works", done => {
  let context = {};
  tracker.setTracked(context);

  https.get("https://google.com", _res => {
    expect(tracker.getTracked()).toBe(context);
    expect(event.sentEvents.length).toBe(1);
    expect(event.sentEvents[0].type).toBe("https");
    expect(event.sentEvents[0].appEventPrefix).toBe("request");
    done();
  });
});
