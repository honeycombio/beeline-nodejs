/* eslint-env node, jest */
const child_process = require("child_process"),
  instrumentChildProcess = require("./child_process"),
  tracker = require("../async_tracker"),
  api = require("../api"),
  schema = require("../schema");

function newMockContext() {
  return { id: 0, spanId: 50000, stack: [] };
}

instrumentChildProcess(child_process);

beforeAll(() => api.configure({ impl: "mock" }));

test("exec 'echo hi' works", done => {
  tracker.setTracked(newMockContext());

  child_process.exec("echo hi", (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");
    expect(api._apiForTesting().sentEvents.length).toBe(1);

    let ev = api._apiForTesting().sentEvents[0];
    expect(ev["exec.file"]).toBe("echo hi");
    expect(ev["exec.args"]).toBeUndefined();
    expect(ev[schema.TRACE_SPAN_NAME]).toBe("execFile");
    api._apiForTesting().sentEvents.splice(0, 1);
    done();
  });
});

test("execFile '/bin/echo hi' works", done => {
  tracker.setTracked(newMockContext());

  child_process.execFile("echo", ["hi"], (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");

    expect(api._apiForTesting().sentEvents.length).toBe(1);

    let ev = api._apiForTesting().sentEvents[0];

    expect(ev["exec.file"]).toBe("echo");
    expect(ev["exec.args"]).toEqual(["hi"]);
    expect(ev[schema.TRACE_SPAN_NAME]).toBe("execFile");
    api._apiForTesting().sentEvents.splice(0, 1);
    done();
  });
});
