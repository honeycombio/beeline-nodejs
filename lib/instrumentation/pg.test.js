/* eslint-env node, jest */
const api = require("../api"),
  instrumentPG = require("./pg");

const pg = instrumentPG(require("pg"));

describe("pg", () => {
  const callback = (client, trace, done) => {
    return () => {
      api.finishTrace(trace);
      client.end();
      const [event] = api._apiForTesting().sentEvents;
      expect(event).toMatchObject({
        "db.query": expect.any(String),
        "db.rows_affected": expect.any(Number),
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
    const trace = api.startTrace();
    const client = new pg.Client();
    client.connect();
    client.query("SELECT 1;", callback(client, trace, done));
  });

  test("basic query with values and callback", done => {
    const trace = api.startTrace();
    const client = new pg.Client();
    client.connect();
    client.query("select $1::text as name;", ["honeycomb"], callback(client, trace, done));
  });

  test("query config object with callback", done => {
    const trace = api.startTrace();
    const client = new pg.Client();
    client.connect();
    const query = {
      text: "select $1::text as name;",
      values: ["honeycomb"],
    };
    client.query(query, callback(client, trace, done));
  });

  test("query object with internal callback", done => {
    const trace = api.startTrace();
    const client = new pg.Client();
    client.connect();
    const query = new pg.Query(
      "select $1::text as name",
      ["brianc"],
      callback(client, trace, done)
    );
    client.query(query);
  });
});
