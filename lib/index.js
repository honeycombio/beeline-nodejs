/* global require module */
const Module = require("module"),
  shimmer = require("shimmer"),
  event = require("./event"),
  magic = require("./magic");

function configure(opts = {}) {
  event.configure(opts);
  magic.instrumentPreload();

  if (!opts.__disableModuleLoadMagic) {
    shimmer.wrap(Module, "_load", function(original) {
      return function(request, parent, isMain) {
        let mod = original.apply(this, [request, parent, isMain]);
        return magic.instrumentLoad(mod, request, parent);
      };
    });
  }

  return configure;
}

configure.asyncTracker = require("./async_tracker");
configure.customContext = event.customContext;

module.exports = configure;
