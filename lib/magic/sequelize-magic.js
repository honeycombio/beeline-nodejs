const instrumentBluebird = require("./bluebird-magic");

let instrumentSequelize = sequelize => {
  instrumentBluebird(sequelize.Promise);
  return sequelize;
};

module.exports = instrumentSequelize;
