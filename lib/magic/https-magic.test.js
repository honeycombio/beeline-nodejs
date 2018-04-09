/* global require expect beforeAll test */
const https = require("https"),
  instrumentHttps = require("./https-magic"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  event = require("../event");

instrumentHttps(https, {});

// XXX(toshok) we need to start an https server so we can work without net access.
// transliterating http-magic.test.js to https doesn't seem to work.
beforeAll(() => {
  event.configure({ api: "mock" });
});

test("GET https://google.com works", done => {
  let context = {};
  tracker.setTracked(context);

  https.get("https://google.com", _res => {
    expect(tracker.getTracked()).toBe(context);
    expect(event.apiForTesting().sentEvents.length).toBe(1);
    expect(event.apiForTesting().sentEvents[0][schema.EVENT_TYPE]).toBe("https");
    expect(event.apiForTesting().sentEvents[0].appEventPrefix).toBe("request");
    expect(event.apiForTesting().sentEvents[0].url).toBe("https://google.com");
    done();
  });
});
