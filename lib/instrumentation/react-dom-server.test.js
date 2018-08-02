/* eslint-env node, jest */
const ReactDOMServer = require("react-dom/server"),
  React = require("react"),
  instrumentReactDOMServer = require("./react-dom-server"),
  schema = require("../schema"),
  tracker = require("../async_tracker"),
  api = require("../api");

instrumentReactDOMServer(ReactDOMServer);

beforeAll(() => {
  api.configure({ impl: "mock" });
});

describe("renderToString", () => {
  test("works with context (and sends event)", () => {
    let context = { stack: [] };
    tracker.setTracked(context);

    ReactDOMServer.renderToString(React.createElement("div"));

    expect(api._apiForTesting().sentEvents).toEqual([
      expect.objectContaining({
        [schema.EVENT_TYPE]: "react",
        [schema.TRACE_SPAN_NAME]: "renderToString",
        [schema.DURATION_MS]: expect.any(Number),
      }),
    ]);
    expect(api._apiForTesting().sentEvents.length).toBe(1);
    // XXX more here
    api._apiForTesting().sentEvents.splice(0, 1);
  });

  test("works without context (sends no event)", () => {
    api.runWithoutTrace(() => {
      ReactDOMServer.renderToString(React.createElement("div"));

      expect(api._apiForTesting().sentEvents.length).toBe(0);
    });
  });
});

describe("renderToStaticMarkup", () => {
  test("works with context (and sends event)", () => {
    let context = { stack: [] };
    tracker.setTracked(context);

    ReactDOMServer.renderToStaticMarkup(React.createElement("div"));

    expect(api._apiForTesting().sentEvents).toEqual([
      expect.objectContaining({
        [schema.EVENT_TYPE]: "react",
        [schema.TRACE_SPAN_NAME]: "renderToStaticMarkup",
        [schema.DURATION_MS]: expect.any(Number),
      }),
    ]);
    expect(api._apiForTesting().sentEvents.length).toBe(1);
    // XXX more here
    api._apiForTesting().sentEvents.splice(0, 1);
  });

  test("works without context (sends no event)", () => {
    api.runWithoutTrace(() => {
      ReactDOMServer.renderToStaticMarkup(React.createElement("div"));

      expect(api._apiForTesting().sentEvents.length).toBe(0);
    });
  });
});
