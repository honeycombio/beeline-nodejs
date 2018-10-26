/* eslint-env node, jest */
const http = require("http"),
  instrumentHttp = require("./http"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  api = require("../api");

function newMockContext() {
  return { id: 0, spanId: 50000, stack: [] };
}

instrumentHttp(http);

let server;
beforeAll(() => {
  server = http.createServer((req, res) => {
    res.setHeader(api.TRACE_HTTP_HEADER, req.headers[api.TRACE_HTTP_HEADER.toLowerCase()]);
    res.end();
  });

  server.listen(9009, "localhost");
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
