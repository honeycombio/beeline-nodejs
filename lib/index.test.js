test("the default export from the package has asyncTracker and customContext properties", () => {
  const honeyMagic = require("./");
  expect(honeyMagic.asyncTracker).toBeDefined();
  expect(honeyMagic.customContext).toBeDefined();
});

test("the default export function returns itself, so the properties are still there.", () => {
  const honeyMagic = require("./");
  let rv = honeyMagic({ __disableModuleLoadMagic: true });
  expect(rv).toBe(honeyMagic);
  expect(rv.asyncTracker).toBeDefined();
  expect(rv.customContext).toBeDefined();
});

test("the function is idempotent.  call it as often as you want.", () => {
  const honeyMagic = require("./");
  honeyMagic({ __disableModuleLoadMagic: true });
  honeyMagic({ __disableModuleLoadMagic: true });
});
