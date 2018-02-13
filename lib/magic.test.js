const magic = require("./magic"),
  methods = require("methods");

test("preload shims Promise.then", () => {
  expect(Promise.prototype.then.__wrapped).toBeUndefined();
  magic.instrumentPreload();
  expect(Promise.prototype.then.__wrapped).toBe(true);
});

let createFakeExpress = () => {
  let Route = function() {};
  Route.prototype.use = function() {};
  methods.concat("all").forEach(method => {
    Route.prototype[method] = function() {};
  });
  return {
    Route,
  };
};

let createFakeChildProcess = () => ({
  exec() {},
  execFile() {},
});

test("we don't instrument modules if the requesting module is from our package", () => {
  magic.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let m = magic.instrumentLoad(fakeExpress, "express", {
    id: "foo/stuff/node_modules/honeycomb-nodejs-magic/lib/index.js",
  });
  // we instrument in-place
  expect(m).toBe(fakeExpress);
  expect(m.Route.prototype.use.__wrapped).toBeUndefined();
});

test("we only instrument once and then cache the result", () => {
  magic.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let m = magic.instrumentLoad(fakeExpress, "express", { id: "foo/stuff/node_modules/" });
  // we instrument in-place
  expect(m).toBe(fakeExpress);
  expect(m.Route.prototype.use.__wrapped).toBe(true);

  // change the use function to be something else, and instrument again
  m.Route.prototype.use = function() {};
  let m2 = magic.instrumentLoad(fakeExpress, "express", { id: "foo/stuff/node_modules/" });
  // we return the cached result
  expect(m2).toBe(fakeExpress);
  // and we don't rewrap the use method
  expect(m.Route.prototype.use.__wrapped).toBeUndefined();
});

test("instrumentation is keyed off the requested module name, not the module itself", () => {
  magic.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let m = magic.instrumentLoad(fakeExpress, "express2", { id: "foo/stuff/node_modules/" });

  // we return fakeExpress uninstrumented because we don't recognize the name
  expect(m).toBe(fakeExpress);
  expect(m.Route.prototype.use.__wrapped).toBeUndefined();
});

test("we keep track of the active instrumentations in a sorted array", () => {
  magic.clearInstrumentationForTesting();
  let fakeExpress = createFakeExpress();
  let fakeChildProcess = createFakeChildProcess();
  expect(magic.activeInstrumentations()).toEqual([]);

  // instrument (and make sure we instrumented) express
  let m = magic.instrumentLoad(fakeExpress, "express", { id: "foo/stuff/node_modules/" });
  expect(m.Route.prototype.use.__wrapped).toBe(true);

  // now it should show up in our activeInstrumentations
  expect(magic.activeInstrumentations()).toEqual(["express"]);

  // instrument (and make sure we instrumented) child_process
  let m2 = magic.instrumentLoad(fakeChildProcess, "child_process", {
    id: "foo/stuff/node_modules/",
  });
  expect(m2.exec.__wrapped).toBe(true);

  // activeInstrumentations now includes child_process
  expect(magic.activeInstrumentations()).toEqual(["child_process", "express"]);
});
