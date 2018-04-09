/* global require expect test beforeAll */
const child_process = require("child_process"),
  instrumentChildProcess = require("./child_process-magic"),
  tracker = require("../async_tracker"),
  event = require("../event");

instrumentChildProcess(child_process, {});

beforeAll(() => event.configure({ api: "mock" }));

test("exec 'echo hi' works", done => {
  let context = {};
  tracker.setTracked(context);

  child_process.exec("echo hi", (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");
    expect(tracker.getTracked()).toBe(context);
    expect(event.apiForTesting().sentEvents.length).toBe(1);
    expect(event.apiForTesting().sentEvents[0].file).toBe("echo hi");
    expect(event.apiForTesting().sentEvents[0].args).toBeUndefined();
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
    expect(event.apiForTesting().sentEvents[0].file).toBe("echo");
    expect(event.apiForTesting().sentEvents[0].args).toEqual(["hi"]);
    event.apiForTesting().sentEvents.splice(0, 1);
    done();
  });
});
