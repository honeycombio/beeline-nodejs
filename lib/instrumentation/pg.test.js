/* eslint-env node, jest */
const api = require("../api"),
  instrumentPG = require("./pg"),
  QueryStream = require("pg-query-stream");

const pg = instrumentPG(require("pg"));

const assertEventFields = () => {
  const events = api._apiForTesting().sentEvents;
  const event = events.find((e) => e.name === "query");
  expect(event).toMatchObject({
    "db.query": expect.any(String),
    "db.rows_affected": 1,
  });
};

describe("pg", () => {
  const callback = (client, done) => {
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

  const resultTestingCallback = (client, done, expectedResultRowZero) => {
    return (err, res) => {
      expect(err === null || err === undefined).toBeTruthy();
      expect(res.rows[0]).toEqual(expectedResultRowZero);
      assertEventFields();
      client.end().then(() => done());
    };
  };

  beforeEach(() => {
    api.configure({ impl: "mock" });
  });

  afterEach(() => {
    api._resetForTesting();
  });

  describe("basic query", () => {
    test("with no values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      client.query("SELECT 1 as value;", resultTestingCallback(client, done, { value: 1 }));
      api.finishTrace(trace);
    });

    test("with values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      client.query(
        "select $1::text as name;",
        ["honeycomb"],
        resultTestingCallback(client, done, { name: "honeycomb" })
      );
      api.finishTrace(trace);
    });

    test("with query config object and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      const query = {
        text: "select $1::text as name;",
        values: ["honeycomb"],
      };
      client.query(query, resultTestingCallback(client, done, { name: "honeycomb" }));
      api.finishTrace(trace);
    });

    test("with query object with internal callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      const query = new pg.Query(
        "select $1::text as name",
        ["brianc"],
        resultTestingCallback(client, done, { name: "brianc" })
      );
      client.query(query);
      api.finishTrace(trace);
    });

    test("with no values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      client
        .query("SELECT 2 as value;")
        .then((result) => {
          expect(result.rows[0]).toEqual({ value: 2 });
          assertEventFields();
        })
        .finally(() => {
          client.end();
          api.finishTrace(trace);
          done();
        });
    });

    test("with values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      client
        .query("select $1::text as name;", ["honeycomb"])
        .then((result) => {
          expect(result.rows[0]).toEqual({ name: "honeycomb" });
          assertEventFields();
        })
        .finally(() => {
          client.end();
          api.finishTrace(trace);
          done();
        });
    });
  });

  test("pg-query-stream", (done) => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    const query = new QueryStream("SELECT * FROM generate_series(0, $1) num", [10]);
    const stream = client.query(query);
    stream.on("close", callback(client, done));
    stream.on("readable", stream.read);
    api.finishTrace(trace);
  });

  describe("pool query", () => {
    test("with no values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.query("select 3 as value;", resultTestingCallback(pool, done, { value: 3 }));
      api.finishTrace(trace);
    });

    test("with values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.query(
        "select $1::text as name;",
        ["honeycomb"],
        resultTestingCallback(pool, done, { name: "honeycomb" })
      );
      api.finishTrace(trace);
    });

    test("with query object and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      const query = {
        text: "select $1::text as name;",
        values: ["honeycomb"],
      };
      pool.query(query, resultTestingCallback(pool, done, { name: "honeycomb" }));
      api.finishTrace(trace);
    });

    test("with no values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool
        .query("select 3 as value;")
        .then((result) => {
          expect(result.rows[0]).toEqual({ value: 3 });
          assertEventFields();
        })
        .finally(() => {
          pool.end();
          api.finishTrace(trace);
          done();
        });
    });

    test("with values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool
        .query("select $1::text as name;", ["honeycomb"])
        .then((result) => {
          expect(result.rows[0]).toEqual({ name: "honeycomb" });
          assertEventFields();
        })
        .finally(() => {
          pool.end();
          api.finishTrace(trace);
          done();
        });
    });

    test("with query object returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      const query = {
        text: "select $1::text as name;",
        values: ["honeycomb"],
      };
      pool
        .query(query)
        .then((result) => {
          expect(result.rows[0]).toEqual({ name: "honeycomb" });
          assertEventFields();
        })
        .finally(() => {
          pool.end();
          api.finishTrace(trace);
          done();
        });
    });
  });

  describe("pool client", () => {
    test("with no values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) => {
        client.query("select 4 as value;", resultTestingCallback(client, done, { value: 4 }));
        api.finishTrace(trace);
      });
    });

    test("with values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) => {
        client.query(
          "select $1::text as name;",
          ["honeycomb"],
          resultTestingCallback(client, done, { name: "honeycomb" })
        );
        api.finishTrace(trace);
      });
    });

    test("with query object and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) => {
        const query = {
          text: "select $1::text as name;",
          values: ["honeycomb"],
        };
        client.query(query, resultTestingCallback(client, done, { name: "honeycomb" }));
        api.finishTrace(trace);
      });
    });

    test("with no values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) =>
        client
          .query("select 3 as value;")
          .then((result) => {
            expect(result.rows[0]).toEqual({ value: 3 });
            assertEventFields();
          })
          .finally(() => {
            client.release();
            api.finishTrace(trace);
            pool.end().then(() => done());
          })
      );
    });

    test("with values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) =>
        client
          .query("select $1::text as name;", ["honeycomb"])
          .then((result) => {
            expect(result.rows[0]).toEqual({ name: "honeycomb" });
            assertEventFields();
          })
          .finally(() => {
            client.release();
            api.finishTrace(trace);
            pool.end().then(() => done());
          })
      );
    });

    test("with query object returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) => {
        const query = {
          text: "select $1::text as name;",
          values: ["honeycomb"],
        };
        client
          .query(query)
          .then((result) => {
            expect(result.rows[0]).toEqual({ name: "honeycomb" });
            assertEventFields();
          })
          .finally(() => {
            client.release();
            api.finishTrace(trace);
            pool.end().then(() => done());
          });
      });
    });
  });
});
