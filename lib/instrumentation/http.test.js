/* eslint-env node, jest */
const semver = require("semver"),
  http = require("http"),
  instrumentHttp = require("./http"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  api = require("../api");

function newMockContext() {
  return { id: 0, spanId: 50000, stack: [] };
}

instrumentHttp(http);

let server;
beforeAll(done => {
  server = http.createServer((req, res) => {
    res.setHeader(
      api.TRACE_HTTP_HEADER,
      req.headers[api.TRACE_HTTP_HEADER.toLowerCase()] || "missing"
    );
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Length", "42");
    res.end();
  });

  server.listen(9009, "localhost", done);
});

afterAll(() => {
  server.close();
  server = null;
});

beforeEach(() => {
  api.configure({ impl: "mock" });
});
afterEach(() => {
  api._resetForTesting();
});

test("url as a string", done => {
  tracker.setTracked(newMockContext());

  http.get("http://localhost:9009", res => {
    expect(res.headers[api.TRACE_HTTP_HEADER.toLowerCase()]).toBe(
      "1;trace_id=0,parent_id=51001,context=e30="
    );
    expect(api._apiForTesting().sentEvents).toMatchObject([
      {
        [schema.EVENT_TYPE]: "http",
        [schema.TRACE_SPAN_NAME]: "GET",
        url: "http://localhost:9009/",
      },
    ]);
    done();
  });
});

test("url as options", done => {
  tracker.setTracked(newMockContext());

  http.get(
    {
      hostname: "localhost",
      port: 9009,
    },
    res => {
      expect(res.headers[api.TRACE_HTTP_HEADER.toLowerCase()]).toBe(
        "1;trace_id=0,parent_id=51001,context=e30="
      );
      expect(api._apiForTesting().sentEvents).toEqual([
        expect.objectContaining({
          [schema.EVENT_TYPE]: "http",
          name: "GET",
          url: "http://localhost:9009/",
        }),
      ]);
      done();
    }
  );
});

test("correct response context", done => {
  tracker.setTracked(newMockContext());

  http.get("http://localhost:9009", res => {
    expect(res.headers[api.TRACE_HTTP_HEADER.toLowerCase()]).toBe(
      "1;trace_id=0,parent_id=51001,context=e30="
    );
    expect(api._apiForTesting().sentEvents).toEqual([
      expect.objectContaining({
        [schema.EVENT_TYPE]: "http",
        name: "GET",
        url: "http://localhost:9009/",
        "response.http_version": res.httpVersion,
        "response.status_code": res.statusCode,
        "response.content_length": res.headers["content-length"],
        "response.content_type": res.headers["content-type"],
        "response.content_encoding": res.headers["content-encoding"],
      }),
    ]);
    done();
  });
});

test("node 10.9.0+ url + options", done => {
  if (semver.lt(process.version, "10.9.0")) {
    // don't run this test for these versions
    done();
    return;
  }

  tracker.setTracked(newMockContext());

  http.get(
    "http://localhost:80",
    {
      hostname: "localhost",
      port: 9009,
    },
    res => {
      expect(res.headers[api.TRACE_HTTP_HEADER.toLowerCase()]).toBe(
        "1;trace_id=0,parent_id=51001,context=e30="
      );
      expect(api._apiForTesting().sentEvents).toEqual([
        expect.objectContaining({
          [schema.EVENT_TYPE]: "http",
          name: "GET",
          url: "http://localhost:9009/",
        }),
      ]);
      done();
    }
  );
});

test("node 10.9.0+ url + options, without active trace", done => {
  if (semver.lt(process.version, "10.9.0")) {
    // don't run this test for these versions
    done();
    return;
  }

  http.get(
    "http://localhost:80",
    {
      hostname: "localhost",
      port: 9009,
    },
    res => {
      expect(res.headers[api.TRACE_HTTP_HEADER.toLowerCase()]).toBe("missing");
      expect(api._apiForTesting().sentEvents).toEqual([]);
      done();
    }
  );
});
