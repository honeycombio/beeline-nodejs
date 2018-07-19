/* eslint-env node, jest */
const child_process = require("child_process"),
  instrumentChildProcess = require("./child_process"),
  tracker = require("../async_tracker"),
  event = require("../event_api"),
  schema = require("../schema");

instrumentChildProcess(child_process);

beforeAll(() => event.configure({ api: "mock" }));

test("exec 'echo hi' works", done => {
  let context = { stack: [] };
  tracker.setTracked(context);

  child_process.exec("echo hi", (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");
    expect(tracker.getTracked()).toBe(context);
    expect(event._apiForTesting().sentEvents.length).toBe(1);

    let ev = event._apiForTesting().sentEvents[0];
    expect(ev["exec.file"]).toBe("echo hi");
    expect(ev["exec.args"]).toBeUndefined();
    expect(ev[schema.TRACE_SPAN_NAME]).toBe("execFile");
    event._apiForTesting().sentEvents.splice(0, 1);
    done();
  });
});

test("execFile '/bin/echo hi' works", done => {
  let context = { stack: [] };
  tracker.setTracked(context);

  child_process.execFile("echo", ["hi"], (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");
    expect(tracker.getTracked()).toBe(context);
    expect(event._apiForTesting().sentEvents.length).toBe(1);

    let ev = event._apiForTesting().sentEvents[0];

    expect(ev["exec.file"]).toBe("echo");
    expect(ev["exec.args"]).toEqual(["hi"]);
    expect(ev[schema.TRACE_SPAN_NAME]).toBe("execFile");
    event._apiForTesting().sentEvents.splice(0, 1);
    done();
  });
});
