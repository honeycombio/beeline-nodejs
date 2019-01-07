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

function testIf(flag, name, testBody) {
  if (flag) {
    test(name, testBody);
  } else {
    test.skip(name, testBody);
  }
}

testIf(semver.lt(process.version, "9.0.0"), "both https and http should be sent", done => {
  tracker.setTracked(newMockContext());

  https.get(
    {
      hostname: "www.google.com",
    },
    _res => {
      expect(api._apiForTesting().sentEvents).toMatchObject([
        {
          [schema.EVENT_TYPE]: "http",
          name: "GET",
          url: "https://www.google.com:443/",
        },
        {
          [schema.EVENT_TYPE]: "https",
          name: "GET",
          url: "https://www.google.com/",
        },
      ]);
      done();
    }
  );
});
