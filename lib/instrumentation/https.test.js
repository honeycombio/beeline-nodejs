/* eslint-env node, jest */
const https = require("https"),
  instrumentHttps = require("./https"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  api = require("../api");

function newMockContext() {
  return { id: 0, spanId: 50000, stack: [] };
}

instrumentHttps(https);

// XXX(toshok) we need to start an https server so we can work without net access.
// transliterating http.test.js to https doesn't seem to work.
beforeEach(() => {
  api.configure({ impl: "mock" });
});
afterEach(() => {
  api._resetForTesting();
});

test("url as a string", done => {
  tracker.setTracked(newMockContext());

  https.get("https://google.com", _res => {
    expect(api._apiForTesting().sentEvents).toMatchObject([
      {
        [schema.EVENT_TYPE]: "https",
        [schema.TRACE_SPAN_NAME]: "GET",
        url: "https://google.com/",
      },
    ]);
    done();
  });
});

test("url as options", done => {
  tracker.setTracked(newMockContext());

  https.get(
    {
      hostname: "google.com",
    },
    _res => {
      expect(api._apiForTesting().sentEvents).toEqual([
        expect.objectContaining({
          [schema.EVENT_TYPE]: "https",
          name: "GET",
          url: "https://google.com/",
        }),
      ]);
      done();
    }
  );
});
