/* eslint-env node, jest */
const api = require("../api"),
  instrumentPG = require("./pg"),
  QueryStream = require("pg-query-stream");

const pg = instrumentPG(require("pg"));

describe("pg", () => {
  const callback = (client, trace, done) => {
    return () => {
      client.end();
      const events = api._apiForTesting().sentEvents;
      const event = events.find((e) => e.name === "query");
      expect(event).toMatchObject({
        "db.query": expect.any(String),
      });
      done();
    };
  };

  const resultTestingCallback = (
    client,
    trace,
    done,
    expectedResultRowZero,
    expectedError = null
  ) => {
    return (err, res) => {
      expect(err).toEqual(expectedError);
      expect(res.rows[0]).toEqual(expectedResultRowZero);
      client.end();
      const events = api._apiForTesting().sentEvents;
      const event = events.find((e) => e.name === "query");
      expect(event).toMatchObject({
        "db.query": expect.any(String),
        "db.rows_affected": 1,
      });
      done();
    };
  };

  beforeEach(() => {
    api.configure({ impl: "mock" });
  });

  afterEach(() => {
    api._resetForTesting();
  });

  test("basic query with callback", (done) => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    client.query("SELECT 1 as value;", resultTestingCallback(client, trace, done, { value: 1 }));
    api.finishTrace(trace);
  });

  test("basic query with values and callback", (done) => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    client.query(
      "select $1::text as name;",
      ["honeycomb"],
      resultTestingCallback(client, trace, done, { name: "honeycomb" })
    );
    api.finishTrace(trace);
  });

  test("query config object with callback", (done) => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    const query = {
      text: "select $1::text as name;",
      values: ["honeycomb"],
    };
    client.query(query, resultTestingCallback(client, trace, done, { name: "honeycomb" }));
    api.finishTrace(trace);
  });

  test("query object with internal callback", (done) => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    const query = new pg.Query(
      "select $1::text as name",
      ["brianc"],
      resultTestingCallback(client, trace, done, { name: "brianc" })
    );
    client.query(query);
    api.finishTrace(trace);
  });

  test("pg-query-stream", (done) => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    const query = new QueryStream("SELECT * FROM generate_series(0, $1) num", [10]);
    const stream = client.query(query);
    stream.on("close", callback(client, trace, done));
    stream.on("readable", stream.read);
    api.finishTrace(trace);
  });
});
