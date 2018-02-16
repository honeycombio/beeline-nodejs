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
            let tracked = tracker.getTracked();
            if (!tracked) {
              return original.apply(this, [source, args, context, info]);
            }
            let startTime = Date.now();
            const result = (original || defaultFieldResolver)(source, args, context, info);

            whenResultIsFinished(result, () => {
              let duration_ms = (Date.now() - startTime) / 1000;
              event.sendEvent(tracked, "graphql", startTime, "resolver", {
                resolver: fieldName,
                duration_ms,
              });
            });
            return result;
          };
        }
      });
    }
  });
}

// copied from
// https://github.com/apollographql/graphql-extensions/blob/298ae014c614000b823b3ea908aba2d2091e40e2/src/index.ts#L188
// with this PR applied
// https://github.com/apollographql/graphql-extensions/pull/4
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
