/* eslint-env node, jest */
const request = require("supertest"),
  path = require("path"),
  instrumentFastify = require("./fastify"),
  cases = require("jest-in-case"),
  schema = require("../schema"),
  api = require("../api"),
  pkg = require(path.join(__dirname, "..", "..", "package.json"));

describe("userContext", () => {
  function runCase(opts, done) {
    const fastify = instrumentFastify(require("fastify"), opts);
    expect(fastify.__wrapped).toBe(true);

    function initializeTestServer() {
      return new Promise((resolve, reject) => {
        const app = fastify();
        app.get("/", function(request, reply) {
          /* add a user */
          request.user = {
            id: 42,
            username: "toshok",
          };
          reply.code(200).send("ok");
        });

        app.listen(4000, err => (err ? reject(err) : resolve(app)));
      });
    }

    api.configure({ impl: "mock" });
    initializeTestServer().then(app => {
      request(app.server)
        .get("/")
        .expect(200, () => {
          const sentEvents = api._apiForTesting().sentEvents;
          expect(sentEvents.length).toBe(2);

          expect(sentEvents).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                [schema.TRACE_ID]: 0,
                [schema.TRACE_PARENT_ID]: 50001,
                [schema.TRACE_SPAN_ID]: 50002,
                [schema.TRACE_SPAN_NAME]: "handler: GET /",
                [schema.EVENT_TYPE]: "fastify",
                [schema.PACKAGE_VERSION]: "1.1.1",
                [schema.DURATION_MS]: 0,
                [schema.BEELINE_VERSION]: pkg.version,
              }),
              expect.objectContaining({
                [schema.TRACE_ID]: 0,
                [schema.TRACE_SPAN_ID]: 50001,
                [schema.TRACE_ID_SOURCE]: undefined,
                [schema.TRACE_SPAN_NAME]: "request",
                [schema.EVENT_TYPE]: "fastify",
                [schema.PACKAGE_VERSION]: "1.1.1",
                [schema.DURATION_MS]: 0,
                [schema.BEELINE_VERSION]: pkg.version,
                "request.host": "127.0.0.1:4000",
                "request.route": undefined,
                "request.original_url": "/",
                "request.remote_addr": "127.0.0.1",
                "request.method": "GET",
                "request.query": {},
                "request.http_version": "HTTP/1.1",
                "request.user.id": 42,
                "request.user.username": "toshok",
                "response.status_code": "200",
              }),
            ])
          );
          api._resetForTesting();
          app.close(done);
        });
    });
  }

  cases("cases", (opts, done) => runCase(opts, done), [
    {
      name: "field array userContext",
      userContext: ["id", "username"],
      packageVersion: "1.1.1",
      traceIdSource: api.REQUEST_ID_HTTP_HEADER,
    },

    {
      description: "function userContext",
      userContext: req => ({ id: req.user.id, username: req.user.username }),
      packageVersion: "1.1.1",
      traceIdSource: api.REQUEST_ID_HTTP_HEADER,
    },
  ]);
});

describe("userContext as function", () => {
  let cb_called = false;

  const fastify = instrumentFastify(require("fastify"), {
    userContext: () => {
      cb_called = true;
      return { random: "stuff" };
    },
  });

  function initializeTestServer() {
    return new Promise((resolve, reject) => {
      const app = fastify();
      app.get("/", function(req, res) {
        // don't add req.user here
        res.code(200).send("ok");
      });

      app.listen(4000, err => (err ? reject(err) : resolve(app)));
    });
  }

  test("it's called even if req.user is undefined", done => {
    api.configure({ impl: "mock" });
    initializeTestServer().then(app => {
      request(app.server)
        .get("/")
        .expect(200, () => {
          expect(cb_called).toBe(true);
          expect(api._apiForTesting().sentEvents.length).toBe(2);
          let ev = api._apiForTesting().sentEvents[1]; // the request span
          expect(ev["request.user.random"]).toBe("stuff");
          api._resetForTesting();
          app.close(done);
        });
    });
  });
});

describe("request id from http headers", () => {
  function runCase(opts, done) {
    const fastify = instrumentFastify(require("fastify"), { traceIdSource: opts.traceIdSource });
    expect(fastify.__wrapped).toBe(true);

    function initializeTestServer() {
      return new Promise((resolve, reject) => {
        const app = fastify();
        app.get("/", function(request, reply) {
          /* add a user */
          request.user = {
            id: 42,
            username: "toshok",
          };
          reply.code(200).send("ok");
        });

        app.listen(4000, err => (err ? reject(err) : resolve(app)));
      });
    }

    api.configure({ impl: "mock" });
    initializeTestServer().then(app => {
      let r = request(app.server).get("/");

      opts.headers.forEach(header => {
        r = r.set(header.name, header.value);
      });

      r.expect(200, () => {
        const sentEvents = api._apiForTesting().sentEvents;
        expect(sentEvents.length).toBe(2);

        let ev = api._apiForTesting().sentEvents[1];
        expect(ev[schema.TRACE_ID]).toBe(opts.expectedHeaderValue);
        expect(ev[schema.TRACE_ID_SOURCE]).toBe(`${opts.expectedHeaderName} http header`);

        api._resetForTesting();
        app.close(done);
      });
    });
  }

  cases("cases", (opts, done) => runCase(opts, done), [
    {
      name: "X-Request-ID works",
      headers: [{ name: "X-Request-ID", value: "abc123" }],
      expectedHeaderName: "X-Request-ID",
      expectedHeaderValue: "abc123",
      traceIdSource: api.REQUEST_ID_HTTP_HEADER,
    },
    {
      name: "X-Request-ID works",
      headers: [{ name: "X-Amzn-Trace-Id", value: "Root=1-67891233-abcdef012345678912345678" }],
      expectedHeaderName: "X-Amzn-Trace-Id",
      expectedHeaderValue: "1-67891233-abcdef012345678912345678",
      traceIdSource: api.AMAZON_TRACE_HTTP_HEADER,
    },
    {
      name: "X-Request-ID > X-Amzn-Trace-Id",
      headers: [
        { name: "X-Request-ID", value: "abc123" },
        { name: "X-Amzn-Trace-Id", value: "Root=1-67891233-abcdef012345678912345678" },
      ],
      expectedHeaderName: "X-Request-ID",
      expectedHeaderValue: "abc123",
      traceIdSource: api.REQUEST_ID_HTTP_HEADER,
    },
  ]);
});

describe("trace id callback", () => {
  function runCase(opts, done) {
    const fastify = instrumentFastify(require("fastify"), {
      traceIdSource: req => req.headers["x-request-id"] || "efgh456",
    });
    expect(fastify.__wrapped).toBe(true);

    function initializeTestServer() {
      return new Promise((resolve, reject) => {
        const app = fastify();
        app.get("/", function(request, reply) {
          reply.code(200).send("ok");
        });

        app.listen(4000, err => (err ? reject(err) : resolve(app)));
      });
    }

    api.configure({ impl: "mock" });
    initializeTestServer().then(app => {
      let r = request(app.server).get("/");

      opts.headers.forEach(header => {
        r = r.set(header.name, header.value);
      });

      r.expect(200, () => {
        const sentEvents = api._apiForTesting().sentEvents;
        expect(sentEvents.length).toBe(2);

        let ev = api._apiForTesting().sentEvents[1];
        expect(ev[schema.TRACE_ID]).toBe(opts.expectedTraceId);
        expect(ev[schema.TRACE_ID_SOURCE]).toBe(opts.expectedTraceIdSource);

        api._resetForTesting();
        app.close(done);
      });
    });
  }

  cases("cases", (opts, done) => runCase(opts, done), [
    {
      name: "returns supplied X-Request-Id (calling the traceIdSource function)",
      headers: [{ name: "X-Request-ID", value: "abc123" }],
      expectedTraceId: "abc123",
      expectedTraceIdSource: "traceIdSource function",
    },

    {
      name: "returns static value if header isn't supplied",
      headers: [],
      expectedTraceId: "efgh456",
      expectedTraceIdSource: "traceIdSource function",
    },
  ]);
});
