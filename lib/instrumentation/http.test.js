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
beforeAll((done) => {
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

describe("argument permutations", () => {
  test("(options)", (done) => {
    tracker.setTracked(newMockContext());

    let req = http.get({ hostname: "localhost", port: 9009 });

    req.on("close", () => {
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

  test("(options, callback)", (done) => {
    tracker.setTracked(newMockContext());

    http.get({ hostname: "localhost", port: 9009 }, () => {
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

  test("(url-string)", (done) => {
    tracker.setTracked(newMockContext());

    let req = http.get("http://localhost:9009");

    req.on("close", () => {
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

  test("(url-string, options)", (done) => {
    tracker.setTracked(newMockContext());

    let req = http.get("http://what.not:8888", { hostname: "localhost", port: 9009 });

    req.on("close", () => {
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

  test("(url-string, callback)", (done) => {
    tracker.setTracked(newMockContext());

    http.get("http://localhost:9009", () => {
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

  test("(url-string, options, callback)", (done) => {
    tracker.setTracked(newMockContext());

    http.get("http://what.not:9999", { hostname: "localhost", port: 9009 }, () => {
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

  test("(url-URL)", (done) => {
    tracker.setTracked(newMockContext());

    let req = http.get(new URL("http://localhost:9009"));

    req.on("close", () => {
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

  test("(url-URL, options)", (done) => {
    tracker.setTracked(newMockContext());

    let req = http.get(new URL("http://what.not:9999"), { hostname: "localhost", port: 9009 });

    req.on("close", () => {
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

  test("(url-URL, callback)", (done) => {
    tracker.setTracked(newMockContext());

    http.get(new URL("http://localhost:9009"), () => {
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

  test("(url-URL, options, callback)", (done) => {
    tracker.setTracked(newMockContext());

    http.get(new URL("http://what.not:9999"), { hostname: "localhost", port: 9009 }, () => {
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
});

test("url as a string", (done) => {
  tracker.setTracked(newMockContext());

  http.get("http://localhost:9009", (res) => {
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

test("url as options", (done) => {
  tracker.setTracked(newMockContext());

  http.get(
    {
      hostname: "localhost",
      port: 9009,
    },
    (res) => {
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

test("url as options with pathname and query", (done) => {
  tracker.setTracked(newMockContext());

  http.get(
    {
      hostname: "localhost",
      port: 9009,
      path: "/test?something=true",
      pathname: "/test",
      search: "?something=true",
    },
    (res) => {
      expect(res.headers[api.TRACE_HTTP_HEADER.toLowerCase()]).toBe(
        "1;trace_id=0,parent_id=51001,context=e30="
      );
      expect(api._apiForTesting().sentEvents).toEqual([
        expect.objectContaining({
          [schema.EVENT_TYPE]: "http",
          name: "GET",
          url: "http://localhost:9009/test?something=true",
        }),
      ]);
      done();
    }
  );
});

test("correct response context", (done) => {
  tracker.setTracked(newMockContext());

  http.get("http://localhost:9009", (res) => {
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

test("node 10.9.0+ url + options", (done) => {
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
    (res) => {
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

test("node 10.9.0+ url + options, without active trace", (done) => {
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
    (res) => {
      expect(res.headers[api.TRACE_HTTP_HEADER.toLowerCase()]).toBe("missing");
      expect(api._apiForTesting().sentEvents).toEqual([]);
      done();
    }
  );
});
