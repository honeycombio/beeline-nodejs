/* eslint-env node, jest */
const semver = require("semver"),
  https = require("https"),
  http = require("http"),
  instrumentHttps = require("./https"),
  instrumentHttp = require("./http"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  api = require("../api");

function newMockContext() {
  return { id: 0, spanId: 50000, stack: [] };
}

instrumentHttp(http);
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
    expect(api._apiForTesting().sentEvents).toMatchObject(
      semver.lt(process.version, "9.0.0")
        ? [
            {
              [schema.EVENT_TYPE]: "http",
              [schema.TRACE_SPAN_NAME]: "GET",
              url: "https://google.com/",
            },
            {
              [schema.EVENT_TYPE]: "https",
              [schema.TRACE_SPAN_NAME]: "GET",
              url: "https://google.com/",
            },
          ]
        : [
            {
              [schema.EVENT_TYPE]: "https",
              [schema.TRACE_SPAN_NAME]: "GET",
              url: "https://google.com/",
            },
          ]
    );
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
      expect(api._apiForTesting().sentEvents).toMatchObject(
        semver.lt(process.version, "9.0.0")
          ? [
              {
                [schema.EVENT_TYPE]: "http",
                [schema.TRACE_SPAN_NAME]: "GET",
                url: "http://google.com:443/",
              },
              {
                [schema.EVENT_TYPE]: "https",
                [schema.TRACE_SPAN_NAME]: "GET",
                url: "https://google.com/",
              },
            ]
          : [
              {
                [schema.EVENT_TYPE]: "https",
                [schema.TRACE_SPAN_NAME]: "GET",
                url: "https://google.com/",
              },
            ]
      );
      done();
    }
  );
});
