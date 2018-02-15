/* global exports */
function Libhoney(args) {
  Libhoney.configuredAPIHost = args.apiHost;
  Libhoney.configuredDataset = args.dataset;
  Libhoney.configuredWriteKey = args.writekey;
  Libhoney.configuredUserAgentAddition = args.userAgentAddition;

  Libhoney.sentEvents = [];
}

Libhoney.prototype.newEvent = function newEvent() {
  return Object.create(EventPrototype);
};

const EventPrototype = {
  add(map) {
    this.data = Object.assign({}, this.data, map);
  },
  send() {
    Libhoney.sentEvents.push(this);
  },
};

exports.default = Libhoney;
