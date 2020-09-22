/* eslint-env node, jest */
test("the default export from the package has our API exported under it", () => {
  const beeline = require(".");
  // a single probe to make sure the API has been copied over.
  expect(beeline.traceActive).not.toBeUndefined();
});

test("the default export function returns itself, so the properties are still there.", () => {
  const beeline = require(".");
  let rv = beeline({ disableInstrumentation: true });
  expect(rv).toBe(beeline);
  expect(rv.traceActive).not.toBeUndefined();
});

test("the function is idempotent.  call it as often as you want.", () => {
  const oldConsole = global.console;
  global.console = { warn: jest.fn() };

  const beeline = require(".");
  beeline();
  expect(console.warn).not.toBeCalled();

  // but we'll warn if you call it again with options
  beeline({ disableInstrumentation: true });
  expect(console.warn).toBeCalled();
  expect(console.warn.mock.calls[0][0]).toEqual(
    expect.stringContaining("Beeline is already configured")
  );

  console.warn.mockClear();

  // and make sure it's just when options are present
  beeline();
  expect(console.warn).not.toBeCalled();

  global.console = oldConsole;
});
