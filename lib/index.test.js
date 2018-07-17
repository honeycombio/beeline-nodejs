/* eslint-env node, jest */
test("the default export from the package has asyncTracker and customContext properties", () => {
  const beeline = require("./");
  expect(beeline.asyncTracker).toBeDefined();
  expect(beeline.customContext).toBeDefined();
});

test("the default export function returns itself, so the properties are still there.", () => {
  const beeline = require("./");
  let rv = beeline({ disableInstrumentation: true });
  expect(rv).toBe(beeline);
  expect(rv.asyncTracker).toBeDefined();
  expect(rv.customContext).toBeDefined();
});

test("the function is idempotent.  call it as often as you want.", () => {
  const beeline = require("./");
  beeline({ disableInstrumentation: true });
  beeline({ disableInstrumentation: true });
});
