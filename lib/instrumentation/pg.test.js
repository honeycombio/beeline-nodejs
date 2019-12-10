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
      const event = events.find(e => e.name === "query");
      expect(event).toMatchObject({
        "db.query": expect.any(String),
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

  test("basic query with callback", done => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    client.query("SELECT 1;", callback(client, trace, done));
    api.finishTrace(trace);
  });

  test("basic query with values and callback", done => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    client.query("select $1::text as name;", ["honeycomb"], callback(client, trace, done));
    api.finishTrace(trace);
  });

  test("query config object with callback", done => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    const query = {
      text: "select $1::text as name;",
      values: ["honeycomb"],
    };
    client.query(query, callback(client, trace, done));
    api.finishTrace(trace);
  });

  test("query object with internal callback", done => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    const query = new pg.Query(
      "select $1::text as name",
      ["brianc"],
      callback(client, trace, done)
    );
    client.query(query);
    api.finishTrace(trace);
  });

  test("pg-query-stream", done => {
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
