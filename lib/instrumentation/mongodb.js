/* eslint-env node */
const shimmer = require("shimmer"),
  event = require("../event_api"),
  schema = require("../schema");

function prefixKeys(prefix, map = {}) {
  let prefixed = {};
  Object.keys(map).forEach(k => {
    prefixed[`${prefix}.${k}`] = map[k];
  });
  return prefixed;
}

function twoArgs(options, callback) {
  if (typeof options === "function") (callback = options), (options = {});
  return [options, callback];
}

function threeArgs(arg1, options, callback) {
  if (typeof options === "function") (callback = options), (options = {});
  return [arg1, options, callback];
}

function fourArgs(arg1, arg2, options, callback) {
  if (typeof options === "function") (callback = options), (options = {});
  return [arg1, arg2, options, callback];
}

function instrumentMongodb(mongodb, opts = {}) {
  function wrap(name, populateArgs, additionalContext) {
    shimmer.wrap(mongodb.Collection.prototype, name, function(original) {
      return function(...args) {
        if (!event.traceActive()) {
          return original.apply(this, args);
        }

        // callback always come last, and there's always options just before it
        let populatedArgs = populateArgs(...args);
        let callback = populatedArgs.pop(); // we'll put this back on (wrapped) when we original.apply below
        let options = populatedArgs[populatedArgs.length - 1];

        let eventName = `collection.${name}`;
        let span = event.startSpan({
          [schema.EVENT_TYPE]: "mongodb",
          [schema.PACKAGE_VERSION]: opts.packageVersion,
          [schema.TRACE_SPAN_NAME]: eventName,
        });

        event.addContext(prefixKeys("db.options", options));
        if (additionalContext) {
          event.addContext(prefixKeys("db", additionalContext(...populatedArgs)));
        }

        let wrapped_cb = event.bindFunctionToTrace(function(...cb_args) {
          event.finishSpan(span, eventName);
          if (callback) {
            return callback(...cb_args);
          }
        });

        return original.apply(this, [...populatedArgs, wrapped_cb]);
      };
    });
  }

  wrap(
    "find",
    (query, options, callback) => {
      let selector = query;
      if (typeof callback !== "function") {
        if (typeof options === "function") {
          callback = options;
          options = undefined;
        } else if (options == null) {
          callback = typeof selector === "function" ? selector : undefined;
          selector = typeof selector === "object" ? selector : undefined;
        }
      }
      return [selector, options, callback];
    },
    query => ({ query })
  );

  wrap("insertOne", threeArgs, document => (opts.includeDocuments ? { document } : {}));
  wrap(
    "insertMany",
    threeArgs,
    documents =>
      opts.includeDocuments
        ? {
            documents,
            documents_count: documents.length,
          }
        : {}
  );
  wrap(
    "bulkWrite",
    threeArgs,
    operations =>
      opts.includeDocuments && Array.isArray(operations)
        ? {
            operations,
            operations_count: operations.length,
          }
        : {}
  );
  // .insert is just a wrapper around .insertMany

  wrap("updateOne", threeArgs, (filter, update) => ({
    filter,
    update,
  }));
  wrap(
    "replaceOne",
    threeArgs,
    (filter, document) =>
      opts.includeDocuments
        ? {
            filter,
            document,
          }
        : {
            filter,
          }
  );
  wrap("updateMany", threeArgs, (filter, update) => ({
    filter,
    update,
  }));
  wrap(
    "update",
    threeArgs,
    (selector, document) =>
      opts.includeDocuments
        ? {
            selector,
            document,
          }
        : {
            selector,
          }
  );

  wrap("deleteOne", threeArgs, filter => ({
    filter,
  }));
  wrap("deleteMany", threeArgs, filter => ({
    filter,
  }));
  wrap("remove", threeArgs, selector => ({
    selector,
  }));

  wrap("save", threeArgs, document => (opts.includeDocuments ? { document } : {}));
  wrap(
    "findOne",
    (query, options, callback) => {
      if (typeof query === "function") (callback = query), (query = {}), (options = {});
      if (typeof options === "function") (callback = options), (options = {});
      query = query || {};
      options = options || {};
      return [query, options, callback];
    },
    query => ({ query })
  );
  wrap("rename", threeArgs, newName => ({ newName }));

  wrap("drop", twoArgs);
  wrap("options", twoArgs);
  wrap("isCapped", twoArgs);

  wrap("createIndex", threeArgs, fieldOrSpec => ({
    fieldOrSpec,
  }));
  wrap("createIndexes", threeArgs, indexSpecs => ({
    indexSpecs,
  }));
  wrap(
    "dropIndex",
    (indexName, ...args) => {
      let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
      let options = args.length ? args.shift() || {} : {};
      return [indexName, options, callback];
    },
    indexName => ({ indexName })
  );
  wrap("dropIndexes", twoArgs);
  wrap("reIndex", twoArgs);
  // XXX(toshok) listIndexes doesn't take a callback, it returns a cursor (ugggh)
  wrap("ensureIndex", threeArgs, fieldOrSpec => ({
    fieldOrSpec,
  }));
  wrap("indexExists", threeArgs, indexes => ({ indexes }));
  wrap("indexInformation", twoArgs);

  wrap(
    "count",
    (...args) => {
      let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
      let query = args.length ? args.shift() || {} : {};
      let options = args.length ? args.shift() || {} : {};
      return [query, options, callback];
    },
    query => ({
      query,
    })
  );
  wrap(
    "distinct",
    (key, ...args) => {
      let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
      let query = args.length ? args.shift() || {} : {};
      let options = args.length ? args.shift() || {} : {};
      return [key, query, options, callback];
    },
    (key, query) => ({
      key,
      query,
    })
  );
  wrap("indexes", twoArgs);
  wrap("stats", twoArgs);

  wrap("findOneAndDelete", threeArgs, filter => ({ filter }));
  wrap("findOneAndReplace", fourArgs, (filter, replacement) => ({
    filter,
    replacement,
  }));
  wrap("findOneAndUpdate", fourArgs, (filter, update) => ({
    filter,
    update,
  }));
  wrap(
    "findAndModify",
    (query, ...args) => {
      let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
      let sort = args.length ? args.shift() || [] : [];
      let doc = args.length ? args.shift() : null;
      let options = args.length ? args.shift() || {} : {};
      return [query, sort, doc, options, callback];
    },
    (query, sort, document) =>
      opts.includeDocuments
        ? {
            document,
            query,
            sort,
          }
        : {
            query,
            sort,
          }
  );
  wrap(
    "findAndRemove",
    (query, ...args) => {
      let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
      let sort = args.length ? args.shift() || [] : [];
      let options = args.length ? args.shift() || {} : {};
      return [query, sort, options, callback];
    },
    (query, sort) => ({
      query,
      sort,
    })
  );

  wrap(
    "aggregate",
    (...args) => {
      let pipeline, options, callback;
      if (Array.isArray(args[0])) {
        pipeline = args[0];
        options = args[1];
        callback = args[2];

        // Set up callback if one is provided
        if (typeof options === "function") {
          callback = options;
          options = {};
        }

        // If we have no options or callback we are doing
        // a cursor based aggregation
        if (options == null && callback == null) {
          options = {};
        }
      } else {
        callback = args.pop();
        // Get the possible options object
        var opts = args[args.length - 1];
        // If it contains any of the admissible options pop it of the args
        options =
          opts &&
          (opts.readPreference ||
            opts.explain ||
            opts.cursor ||
            opts.out ||
            opts.maxTimeMS ||
            opts.hint ||
            opts.allowDiskUse)
            ? args.pop()
            : {};
        // Left over arguments is the pipeline
        pipeline = args;
      }
      return [pipeline, options, callback];
    },
    pipeline => ({ pipeline, pipeline_count: pipeline.length })
  );

  wrap("parallelCollectionScan", (options, callback) => {
    if (typeof options === "function") (callback = options), (options = { numCursors: 1 });
    return [options, callback];
  });
  wrap(
    "geoHaystackSearch",
    (x, y, ...args) => {
      let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
      let options = args.length ? args.shift() || {} : {};
      return [x, y, options, callback];
    },
    (x, y) => ({
      x,
      y,
    })
  );

  // XXX(toshok) .group has a lot of args (and multiple callbacks)
  // XXX(toshok) .map also has a few callbacks

  return mongodb;
}

module.exports = instrumentMongodb;
