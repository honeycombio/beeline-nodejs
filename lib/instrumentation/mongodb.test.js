/* eslint-env node, jest */
const api = require("../api"),
  instrumentMongodb = require("./mongodb");

instrumentMongodb(require("mongodb"));

const { MongoClient } = require("mongodb");

function getLastMongodbEvent() {
  const events = api._apiForTesting().sentEvents;
  const mongodbEvent = events.reverse().find((e) => e["meta.type"] === "mongodb");
  return mongodbEvent;
}

describe("mongodb", () => {
  beforeEach(() => {
    api.configure({ impl: "mock", useDurations: true });
  });

  afterEach(() => {
    api._resetForTesting();
  });

  describe("promises", () => {
    describe("findOne", () => {
      test("with query", async () => {
        await withDB(async (db) => {
          await insertManyRecords(db);

          const trace = api.startTrace({ name: "mongodb-test" });

          await db.collection("users").findOne({ name: "Alice" });

          api.finishTrace(trace);

          const event = getLastMongodbEvent();
          expect(event.name).toEqual("collection.findOne");
          expect(event["db.query"]).toMatchObject({ name: "Alice" });
          expect(event["duration_ms"]).toBeGreaterThan(1);
        });
      });
    });
  });

  describe("cursors", () => {
    describe("find", () => {
      test("with query, no results", async () => {
        await withDB(async (db) => {
          const trace = api.startTrace({ name: "mongodb-test" });

          const cursor = db.collection("users").find({ name: "Bob" });

          await new Promise((resolve) => {
            cursor.forEach(() => {}, resolve);
          });

          api.finishTrace(trace);

          const event = getLastMongodbEvent();
          expect(event.name).toEqual("collection.find");
          expect(event["db.query"]).toMatchObject({ name: "Bob" });
          expect(event["duration_ms"]).toBeGreaterThan(1);
        });
      });

      test("with query, some results", async () => {
        const trace = api.startTrace({ name: "mongodb-test" });

        await withDB(async (db) => {
          await db.collection("users").insertOne({ name: "Bob" });

          const cursor = db.collection("users").find({ name: "Bob" });

          await new Promise((resolve) => {
            cursor.forEach(() => {}, resolve);
          });

          api.finishTrace(trace);

          const event = getLastMongodbEvent();
          expect(event.name).toEqual("collection.find");
          expect(event["db.query"]).toMatchObject({ name: "Bob" });
          expect(event["duration_ms"]).toBeGreaterThan(1);
        });
      });
    });
  });
});

async function withDB(fn) {
  const client = new MongoClient("mongodb://localhost:27017", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await client.connect();

  const db = client.db("honeycomb-beeline-test");

  try {
    await fn(db);
  } finally {
    await client.close();
  }
}

async function insertManyRecords(db) {
  for (let i = 0; i < 10000; i++) await db.collection("users").insertOne({ name: `Alice ${i}` });
}
