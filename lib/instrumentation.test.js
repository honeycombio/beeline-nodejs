/* eslint-env node, jest */
const instrumentation = require("./instrumentation");

test("preload shims Promise.then", () => {
  expect(Promise.prototype.then.__wrapped).toBeUndefined();
  instrumentation.instrumentPreload();
  expect(Promise.prototype.then.__wrapped).toBe(true);
});

let createFakeExpress = () => {
  return {};
};

let createFakeChildProcess = () => ({
  exec() {},
  execFile() {},
});

test("we don't instrument modules if the requesting module is from our package", () => {
  instrumentation.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let m = instrumentation.instrumentLoad(fakeExpress, "express", {
    id: "foo/stuff/node_modules/honeycomb-beeline/lib/index.js",
  });
  expect(m).toBe(fakeExpress);
  expect(m.__wrapped).toBeUndefined();
});

test("we only instrument once and then cache the result", () => {
  instrumentation.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let m = instrumentation.instrumentLoad(fakeExpress, "express", { id: "foo/stuff/node_modules/" });
  // we instrument express by returning a different wrapper
  expect(m).not.toBe(fakeExpress);
  expect(m.__wrapped).toBe(true);

  let m2 = instrumentation.instrumentLoad(fakeExpress, "express", {
    id: "foo/stuff/node_modules/",
  });
  // we return the cached result
  expect(m2).toBe(m);
});

test("instrumentation is keyed off the requested module name, not the module itself", () => {
  instrumentation.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let m = instrumentation.instrumentLoad(fakeExpress, "express2", {
    id: "foo/stuff/node_modules/",
  });

  // we return fakeExpress uninstrumented because we don't recognize the name
  expect(m).toBe(fakeExpress);
  expect(m.__wrapped).toBeUndefined();
});

test("if an instrumentation is disabled, don't instrument the module", () => {
  instrumentation.clearInstrumentationForTesting();
  instrumentation.configure({ enabledInstrumentations: [], disableInstrumentationOnLoad: true });
  let fakeExpress = createFakeExpress();
  let m = instrumentation.instrumentLoad(fakeExpress, "express", {
    id: "foo/stuff/node_modules/",
  });

  expect(m).toBe(fakeExpress);
  expect(m.__wrapped).toBeUndefined();
});

test("if an instrumentation is enabled, instrument the module", () => {
  instrumentation.clearInstrumentationForTesting();
  instrumentation.configure({
    enabledInstrumentations: ["express"],
    disableInstrumentationOnLoad: true,
  });
  let fakeExpress = createFakeExpress();
  let m = instrumentation.instrumentLoad(fakeExpress, "express", {
    id: "foo/stuff/node_modules/",
  });

  expect(m).not.toBe(fakeExpress);
  expect(m.__wrapped).toBe(true);
});

test("we keep track of the active instrumentations in a sorted array", () => {
  instrumentation.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let fakeChildProcess = createFakeChildProcess();
  expect(instrumentation.activeInstrumentations()).toEqual([]);

  // instrument (and make sure we instrumented) express
  let m = instrumentation.instrumentLoad(fakeExpress, "express", { id: "foo/stuff/node_modules/" });
  expect(m.__wrapped).toBe(true);

  // now it should show up in our activeInstrumentations
  expect(instrumentation.activeInstrumentations()).toEqual(["express"]);

  // instrument (and make sure we instrumented) child_process
  let m2 = instrumentation.instrumentLoad(fakeChildProcess, "child_process", {
    id: "foo/stuff/node_modules/",
  });
  expect(m2.execFile.__wrapped).toBe(true);

  // activeInstrumentations now includes child_process
  expect(instrumentation.activeInstrumentations()).toEqual(["child_process", "express"]);
});
