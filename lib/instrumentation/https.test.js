/* global require expect beforeAll test */
const https = require("https"),
  instrumentHttps = require("./https"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  event = require("../event");

instrumentHttps(https);

// XXX(toshok) we need to start an https server so we can work without net access.
// transliterating http.test.js to https doesn't seem to work.
beforeAll(() => {
  event.configure({ api: "mock" });
});

test("GET https://google.com works", done => {
  let context = {};
  tracker.setTracked(context);

  https.get("https://google.com", _res => {
    expect(tracker.getTracked()).toBe(context);
    expect(event.apiForTesting().sentEvents).toMatchObject([
      {
        [schema.EVENT_TYPE]: "https",
        [schema.TRACE_SPAN_NAME]: "request",
        url: "https://google.com",
      },
    ]);
    done();
  });
});
