/* global exports */
let sentEvents = [];
exports.sentEvents = sentEvents;

let eventStack = [];

exports.startRequest = startRequest;
function startRequest() {
  let rv = startEvent(null, "app");
  return rv;
}

exports.finishRequest = finishRequest;
function finishRequest() {
  finishEvent(eventStack[0]);
}

exports.startEvent = startEvent;
function startEvent(_context, type) {
  let ev = { type };
  eventStack.push(ev);
  return ev;
}

exports.finishEvent = finishEvent;
function finishEvent(ev, rollup, duration_ms_field = "duration_ms") {
  Object.assign(ev, {
    appEventPrefix: rollup,
    [duration_ms_field]: 0,
  });
  // pop it off the stack
  let idx = eventStack.indexOf(ev);
  eventStack = eventStack.slice(0, idx);
  sentEvents.push(ev);
}

exports.addContext = addContext;
function addContext(stuff) {
  let ev = eventStack[eventStack.length - 1];
  Object.assign(ev, stuff);
}
