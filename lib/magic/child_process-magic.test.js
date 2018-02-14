const child_process = require("child_process"),
  instrumentChildProcess = require("./child_process-magic"),
  tracker = require("../async_tracker"),
  event = require("../event");

jest.mock("../event");

instrumentChildProcess(child_process);

test("exec 'echo hi' works", done => {
  let context = {};
  tracker.setTracked(context);

  child_process.exec("echo hi", (error, stdout) => {
    expect(error).toBeNull();
    expect(stdout).toBe("hi\n");
    expect(tracker.getTracked()).toBe(context);
    expect(event.sentEvents.length).toBe(1);
    expect(event.sentEvents[0].type_payload.file).toBe("echo hi");
    event.sentEvents.splice(0, 1);
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
    expect(event.sentEvents.length).toBe(1);
    expect(event.sentEvents[0].type_payload.file).toBe("echo");
    event.sentEvents.splice(0, 1);
    done();
  });
});
