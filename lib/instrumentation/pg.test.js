/* eslint-env node, jest */
const api = require("../api"),
  instrumentPG = require("./pg"),
  QueryStream = require("pg-query-stream");

const pg = instrumentPG(require("pg"));

const assertEventFields = (extraFields) => {
  const events = api._apiForTesting().sentEvents;
  const event = events.find((e) => e.name === "query");
  expect(event).toMatchObject({
    "db.query": expect.any(String),
    ...extraFields,
  });
};

const assertEventFieldsWithOneRow = () => assertEventFields({ "db.rows_affected": 1 });
const assertErrorEventFields = (err) =>
  assertEventFields({
    "db.error": err.message,
    "db.error_stack": err.stack,
    "db.error_hint": err.hint,
  });

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

  const successfulResultAssertingCallback = (client, done, expectedResultRowZero) => {
    return (err, res) => {
      expect(err === null || err === undefined).toBeTruthy();
      expect(res.rows[0]).toEqual(expectedResultRowZero);
      assertEventFieldsWithOneRow();
      client.end().then(() => done());
    };
  };

  const failureResultAssertingCallback = (client, done) => {
    return (err, res) => {
      expect(err).toBeDefined();
      expect(res).not.toBeDefined();
      assertErrorEventFields(err);
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
      client.query(
        "SELECT 1 as value;",
        successfulResultAssertingCallback(client, done, { value: 1 })
      );
      api.finishTrace(trace);
    });

    test("with values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      client.query(
        "select $1::text as name;",
        ["honeycomb"],
        successfulResultAssertingCallback(client, done, { name: "honeycomb" })
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
      client.query(query, successfulResultAssertingCallback(client, done, { name: "honeycomb" }));
      api.finishTrace(trace);
    });

    test("with query object with internal callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      const query = new pg.Query(
        "select $1::text as name",
        ["brianc"],
        successfulResultAssertingCallback(client, done, { name: "brianc" })
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
          assertEventFieldsWithOneRow();
        })
        .finally(() => {
          client.end().then(() => done());
          api.finishTrace(trace);
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
          assertEventFieldsWithOneRow();
        })
        .finally(() => {
          client.end().then(() => done());
          api.finishTrace(trace);
        });
    });

    test("with callback returning error", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      client.query(
        "SELECT 1 as value from x;",
        failureResultAssertingCallback(client, done, { value: 1 })
      );
      api.finishTrace(trace);
    });

    test("returning rejected promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const client = new pg.Client();
      client.connect();
      client
        .query("SELECT 1 as value from x;")
        .then((_) => done.fail("expected error to be thrown"))
        .catch((err) => assertErrorEventFields(err))
        .finally(() => {
          client.end().then(() => done());
          api.finishTrace(trace);
        });
      expect.assertions(1);
    });
  });

  test("pg-query-stream", (done) => {
    const trace = api.startTrace({ name: "pg-test" });
    const client = new pg.Client();
    client.connect();
    const query = new QueryStream("SELECT * FROM generate_series(0, $1) num", [10]);
    const stream = client.query(query);
    stream.on("close", callback(client, done));
    stream.on("data", stream.read);
    api.finishTrace(trace);
  });

  describe("pool query", () => {
    test("with no values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.query("select 3 as value;", successfulResultAssertingCallback(pool, done, { value: 3 }));
      api.finishTrace(trace);
    });

    test("with values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.query(
        "select $1::text as name;",
        ["honeycomb"],
        successfulResultAssertingCallback(pool, done, { name: "honeycomb" })
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
      pool.query(query, successfulResultAssertingCallback(pool, done, { name: "honeycomb" }));
      api.finishTrace(trace);
    });

    test("with no values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool
        .query("select 3 as value;")
        .then((result) => {
          expect(result.rows[0]).toEqual({ value: 3 });
          assertEventFieldsWithOneRow();
        })
        .finally(() => {
          pool.end().then(() => done());
          api.finishTrace(trace);
        });
    });

    test("with values returning promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool
        .query("select $1::text as name;", ["honeycomb"])
        .then((result) => {
          expect(result.rows[0]).toEqual({ name: "honeycomb" });
          assertEventFieldsWithOneRow();
        })
        .finally(() => {
          pool.end().then(() => done());
          api.finishTrace(trace);
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
          assertEventFieldsWithOneRow();
        })
        .finally(() => {
          pool.end().then(() => done());
          api.finishTrace(trace);
        });
    });

    test("with callback returning error", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.query(
        "SELECT 1 as value from x;",
        failureResultAssertingCallback(pool, done, { value: 1 })
      );
      api.finishTrace(trace);
    });

    test("returning rejected promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool
        .query("SELECT 1 as value from x;")
        .then((_) => done.fail("expected error to be thrown"))
        .catch((err) => assertErrorEventFields(err))
        .finally(() => {
          pool.end().then(() => done());
          api.finishTrace(trace);
        });
      expect.assertions(1);
    });
  });

  describe("pool client", () => {
    test("with no values and callback", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) => {
        client.query(
          "select 4 as value;",
          successfulResultAssertingCallback(client, done, { value: 4 })
        );
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
          successfulResultAssertingCallback(client, done, { name: "honeycomb" })
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
        client.query(query, successfulResultAssertingCallback(client, done, { name: "honeycomb" }));
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
            assertEventFieldsWithOneRow();
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
            assertEventFieldsWithOneRow();
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
            assertEventFieldsWithOneRow();
          })
          .finally(() => {
            client.release();
            api.finishTrace(trace);
            pool.end().then(() => done());
          });
      });
    });

    test("with callback returning error", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) => {
        client.query(
          "SELECT 1 as value from x;",
          failureResultAssertingCallback(client, done, { value: 1 })
        );
        api.finishTrace(trace);
      });
    });

    test("returning rejected promise", (done) => {
      const trace = api.startTrace({ name: "pg-test" });
      const pool = new pg.Pool();
      pool.connect().then((client) => {
        client
          .query("SELECT 1 as value from x;")
          .then((_) => done.fail("expected error to be thrown"))
          .catch((err) => assertErrorEventFields(err))
          .finally(() => {
            client.release();
            api.finishTrace(trace);
            pool.end().then(() => done());
          });
      });
      expect.assertions(1);
    });
  });
});
