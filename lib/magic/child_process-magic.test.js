/* global require expect test beforeAll */
const child_process = require("child_process"),
  instrumentChildProcess = require("./child_process-magic"),
  tracker = require("../async_tracker"),
  event = require("../event"),
  schema = require("../schema");

instrumentChildProcess(child_process);

beforeAll(() => event.configure({ api: "mock" }));

test("exec 'echo hi' works", done => {
  let context = {};
  tracker.setTracked(context);

  child_process.exec("echo hi", (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");
    expect(tracker.getTracked()).toBe(context);
    expect(event.apiForTesting().sentEvents.length).toBe(1);

    let ev = event.apiForTesting().sentEvents[0];
    expect(ev.file).toBe("echo hi");
    expect(ev.args).toBeUndefined();
    expect(ev[schema.TRACE_SPAN_NAME]).toBe("execFile");
    event.apiForTesting().sentEvents.splice(0, 1);
    done();
  });
});

test("execFile '/bin/echo hi' works", done => {
  let context = {};
  tracker.setTracked(context);

  child_process.execFile("echo", ["hi"], (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");
    expect(tracker.getTracked()).toBe(context);
    expect(event.apiForTesting().sentEvents.length).toBe(1);

    let ev = event.apiForTesting().sentEvents[0];

    expect(ev.file).toBe("echo");
    expect(ev.args).toEqual(["hi"]);
    expect(ev[schema.TRACE_SPAN_NAME]).toBe("execFile");
    event.apiForTesting().sentEvents.splice(0, 1);
    done();
  });
});
