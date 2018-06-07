/* global require, module */
const shimmer = require("shimmer"),
  tracker = require("../async_tracker"),
  event = require("../event"),
  schema = require("../schema");

function startCollectionEvent(context, packageVersion, name) {
  let ev = event.startEvent(context, "mongodb", `collection.${name}`);
  event.addContext({
    [schema.PACKAGE_VERSION]: packageVersion,
  });
  return ev;
}

function finishCollectionEvent(ev, name) {
  event.finishEvent(ev, `collection.${name}`);
}

function prefixOptions(options = {}) {
  let optionsContext = {};
  Object.keys(options).forEach(k => {
    optionsContext[`options.${k}`] = options[k];
  });
  return optionsContext;
}

function wrapTwoArg(mongodb, packageVersion, name, addContext) {
  shimmer.wrap(mongodb.Collection.prototype, name, function(original) {
    return function(options, callback) {
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, [options, callback]);
      }

      // callback arg handling from mongodb/lib/collection's two-arg function pattern
      if (typeof options === "function") (callback = options), (options = {});

      // filled in below the callback
      let ev;

      let wrapped_cb = tracker.bindFunction(function(...cb_args) {
        finishCollectionEvent(ev, name);
        if (callback) {
          return callback(...cb_args);
        }
      });

      ev = startCollectionEvent(context, packageVersion, name);
      addContext(options);
      return original.apply(this, [options, wrapped_cb]);
    };
  });
}

function wrapThreeArg(mongodb, packageVersion, name, addContext) {
  shimmer.wrap(mongodb.Collection.prototype, name, function(original) {
    return function(arg1, options, callback) {
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, [arg1, options, callback]);
      }

      // callback arg handling from mongodb/lib/collection's three-arg function pattern
      if (typeof options === "function") (callback = options), (options = {});

      // filled in below the callback
      let ev;

      let wrapped_cb = tracker.bindFunction(function(...cb_args) {
        finishCollectionEvent(ev, name);
        if (callback) {
          return callback(...cb_args);
        }
      });

      ev = startCollectionEvent(context, packageVersion, name);
      addContext(arg1, options);
      return original.apply(this, [arg1, options, wrapped_cb]);
    };
  });
}

function wrapFourArg(mongodb, packageVersion, name, addContext) {
  shimmer.wrap(mongodb.Collection.prototype, name, function(original) {
    return function(arg1, arg2, options, callback) {
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, [arg1, arg2, options, callback]);
      }

      // callback arg handling from mongodb/lib/collection's four-arg function pattern
      if (typeof options === "function") (callback = options), (options = {});

      // filled in below the callback
      let ev;

      let wrapped_cb = tracker.bindFunction(function(...cb_args) {
        finishCollectionEvent(ev, name);
        if (callback) {
          return callback(...cb_args);
        }
      });

      ev = startCollectionEvent(context, packageVersion, name);
      addContext(arg1, arg2, options);
      return original.apply(this, [arg1, arg2, options, wrapped_cb]);
    };
  });
}

function wrapFiveArg(mongodb, packageVersion, name, addContext) {
  shimmer.wrap(mongodb.Collection.prototype, name, function(original) {
    return function(arg1, arg2, arg3, options, callback) {
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, [arg1, arg2, arg3, options, callback]);
      }

      // callback arg handling from mongodb/lib/collection's four-arg function pattern
      if (typeof options === "function") (callback = options), (options = {});

      // filled in below the callback
      let ev;

      let wrapped_cb = tracker.bindFunction(function(...cb_args) {
        finishCollectionEvent(ev, name);
        if (callback) {
          return callback(...cb_args);
        }
      });

      ev = startCollectionEvent(context, packageVersion, name);
      addContext(arg1, arg2, arg3, options);
      return original.apply(this, [arg1, arg2, arg3, options, wrapped_cb]);
    };
  });
}

let instrumentMongodb = function(mongodb, opts = {}) {
  // special case for `find`.  special argument handling
  shimmer.wrap(mongodb.Collection.prototype, "find", function(original) {
    return function(query, options, callback) {
      let context = tracker.getTracked();
      if (!context) {
        return original.apply(this, [query, options, callback]);
      }

      let selector = query;
      // figuring out arguments
      if (typeof callback !== "function") {
        if (typeof options === "function") {
          callback = options;
          options = undefined;
        } else if (options == null) {
          callback = typeof selector === "function" ? selector : undefined;
          selector = typeof selector === "object" ? selector : undefined;
        }
      }

      // filled in below the callback
      let ev;

      let wrapped_cb = tracker.bindFunction(function(...cb_args) {
        finishCollectionEvent(ev, "find");
        if (callback) {
          return callback(...cb_args);
        }
      });

      ev = startCollectionEvent(context, opts.packageVersion, "find");
      event.addContext(prefixOptions(options));
      event.addContext({
        query,
      });
      return original.apply(this, [selector, options, wrapped_cb]);
    };
  });

  wrapThreeArg(mongodb, opts.packageVersion, "insertOne", (document, options) => {
    event.addContext(prefixOptions(options));
    if (opts.includeDocuments) {
      event.addContext({
        document,
      });
    }
  });
  wrapThreeArg(mongodb, opts.packageVersion, "insertMany", (documents, options) => {
    event.addContext(prefixOptions(options));
    if (opts.includeDocuments && Array.isArray(documents)) {
      event.addContext({
        documents,
        documents_count: documents.length,
      });
    }
  });
  wrapThreeArg(mongodb, opts.packageVersion, "bulkWrite", (operations, options) => {
    event.addContext(prefixOptions(options));
    if (opts.includeDocuments && Array.isArray(operations)) {
      event.addContext({
        operations,
        operations_count: operations.length,
      });
    }
  });
  // .insert is just a wrapper around .insertMany

  wrapFourArg(mongodb, opts.packageVersion, "updateOne", (filter, update, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
      update,
    });
  });
  wrapFourArg(mongodb, opts.packageVersion, "replaceOne", (filter, document, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
    });
    if (opts.includeDocuments) {
      event.addContext({
        document,
      });
    }
  });
  wrapFourArg(mongodb, opts.packageVersion, "updateMany", (filter, update, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
      update,
    });
  });
  wrapFourArg(mongodb, opts.packageVersion, "update", (selector, document, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      selector,
    });
    if (opts.includeDocuments) {
      event.addContext({
        document,
      });
    }
  });

  wrapThreeArg(mongodb, opts.packageVersion, "deleteOne", (filter, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
    });
  });
  wrapThreeArg(mongodb, opts.packageVersion, "deleteMany", (filter, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
    });
  });
  wrapThreeArg(mongodb, opts.packageVersion, "remove", (selector, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      selector,
    });
  });

  wrapThreeArg(mongodb, opts.packageVersion, "save", (document, options) => {
    event.addContext(prefixOptions(options));
    if (opts.includeDocuments) {
      event.addContext({
        document,
      });
    }
  });
  wrapThreeArg(mongodb, opts.packageVersion, "findOne", (query, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      query,
    });
  });
  wrapThreeArg(mongodb, opts.packageVersion, "rename", (newName, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      newName,
    });
  });

  wrapTwoArg(mongodb, opts.packageVersion, "drop", options => {
    event.addContext(prefixOptions(options));
  });
  wrapTwoArg(mongodb, opts.packageVersion, "options", options => {
    event.addContext(prefixOptions(options));
  });
  wrapTwoArg(mongodb, opts.packageVersion, "isCapped", options => {
    event.addContext(prefixOptions(options));
  });

  wrapThreeArg(mongodb, opts.packageVersion, "createIndex", (fieldOrSpec, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      fieldOrSpec,
    });
  });
  wrapThreeArg(mongodb, opts.packageVersion, "createIndexes", (indexSpecs, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      indexSpecs,
    });
  });
  wrapThreeArg(mongodb, opts.packageVersion, "dropIndex", (indexName, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      indexName,
    });
  });
  wrapTwoArg(mongodb, opts.packageVersion, "dropIndexes", options => {
    event.addContext(prefixOptions(options));
  });
  wrapTwoArg(mongodb, opts.packageVersion, "reIndex", options => {
    event.addContext(prefixOptions(options));
  });
  // XXX(toshok) listIndexes doesn't take a callback, it returns a cursor (ugggh)
  wrapThreeArg(mongodb, opts.packageVersion, "ensureIndex", (fieldOrSpec, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      fieldOrSpec,
    });
  });
  wrapThreeArg(mongodb, opts.packageVersion, "indexExists", (indexes, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      indexes,
    });
  });
  wrapTwoArg(mongodb, opts.packageVersion, "indexInformation", options => {
    event.addContext(prefixOptions(options));
  });

  wrapThreeArg(mongodb, opts.packageVersion, "count", (query, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      query,
    });
  });
  wrapFourArg(mongodb, opts.packageVersion, "distinct", (key, query, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      key,
      query,
    });
  });
  wrapTwoArg(mongodb, opts.packageVersion, "indexes", options => {
    event.addContext(prefixOptions(options));
  });
  wrapTwoArg(mongodb, opts.packageVersion, "stats", options => {
    event.addContext(prefixOptions(options));
  });

  wrapThreeArg(mongodb, opts.packageVersion, "findOneAndDelete", (filter, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
    });
  });
  wrapFourArg(mongodb, opts.packageVersion, "findOneAndReplace", (filter, replacement, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
      replacement,
    });
  });
  wrapFourArg(mongodb, opts.packageVersion, "findOneAndUpdate", (filter, update, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      filter,
      update,
    });
  });
  wrapFiveArg(mongodb, opts.packageVersion, "findAndModify", (query, sort, document, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      query,
      sort,
    });
    if (opts.includeDocuments) {
      event.addContext({
        document,
      });
    }
  });
  wrapFourArg(mongodb, opts.packageVersion, "findAndRemove", (query, sort, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      query,
      sort,
    });
  });

  // XXX(toshok) .aggregate has weird parameter handling

  wrapTwoArg(mongodb, opts.packageVersion, "parallelCollectionScan", options => {
    event.addContext(prefixOptions(options));
  });
  wrapFourArg(mongodb, opts.packageVersion, "geoHaystackSearch", (x, y, options) => {
    event.addContext(prefixOptions(options));
    event.addContext({
      x,
      y,
    });
  });

  // XXX(toshok) .group has a lot of args (and multiple callbacks)
  // XXX(toshok) .map also has a few callbacks

  return mongodb;
};

module.exports = instrumentMongodb;
