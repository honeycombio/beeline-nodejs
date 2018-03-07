/* global require module */
const tracker = require("../async_tracker"),
  event = require("../event");

let defaultFieldResolver;

module.exports = instrumentGraphQL;
function instrumentGraphQL(graphql) {
  let newGraphQL = {};
  for (let k of Object.getOwnPropertyNames(graphql)) {
    let original = graphql[k];
    let wrapped = original;

    switch (k) {
      case "GraphQLSchema":
        wrapped = function(opts) {
          let schema = new original(opts);
          wrapResolvers(schema);
          return schema;
        };
        break;
      case "defaultFieldResolver":
        defaultFieldResolver = original;
        break;
    }
    newGraphQL[k] = wrapped;
  }
  return newGraphQL;
}

function wrapResolvers(schema) {
  const typeMap = schema.getTypeMap();
  Object.keys(typeMap).forEach(typeName => {
    const type = typeMap[typeName];

    if (!type.name.startsWith("__") && type.getFields /* && type instanceof GraphQLObjectType*/) {
      const fields = type.getFields();
      Object.keys(fields).forEach(fieldName => {
        const field = fields[fieldName];

        if (field.resolve || defaultFieldResolver) {
          let original = field.resolve;

          field.resolve = function(source, args, context, info) {
            let magicContext = tracker.getTracked();
            if (!magicContext) {
              return original.apply(this, [source, args, context, info]);
            }

            let ev = event.startEvent(magicContext, "graphql");
            const result = (original || defaultFieldResolver)(source, args, context, info);

            whenResultIsFinished(result, () => {
              event.addContext({
                resolver: fieldName,
              });
              event.finishEvent(ev, "resolver");
            });
            return result;
          };
        }
      });
    }
  });
}

// lifted from
// https://github.com/apollographql/graphql-extensions/blob/a3135a9142b8f995af848fab61dfc610f319cbf0/src/index.ts#L166
function whenResultIsFinished(result, callback) {
  if (result === null || typeof result === "undefined") {
    callback();
  } else if (typeof result.then === "function") {
    result.then(callback, callback);
  } else if (Array.isArray(result)) {
    const promises = [];
    result.forEach(value => {
      if (value && typeof value.then === "function") {
        promises.push(value);
      }
    });
    if (promises.length > 0) {
      Promise.all(promises).then(callback, callback);
    } else {
      callback();
    }
  } else {
    callback();
  }
}
