/* eslint-env node */
const shimmer = require("shimmer"),
  api = require("../api"),
  schema = require("../schema");

function prefixKeys(prefix, map) {
  let prefixed = {};
  if (map) {
    Object.keys(map).forEach(k => {
      prefixed[`${prefix}.${k}`] = map[k];
    });
  }
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
        if (!api.traceActive()) {
          return original.apply(this, args);
        }

        // callback always come last, and there's always options just before it
        let populatedArgs = populateArgs(...args);
        let callback = populatedArgs.pop(); // we'll put this back on (wrapped) when we original.apply below
        let options = populatedArgs[populatedArgs.length - 1];

        let eventName = `collection.${name}`;

        return api.startAsyncSpan(
          {
            [schema.EVENT_TYPE]: "mongodb",
            [schema.PACKAGE_VERSION]: opts.packageVersion,
            [schema.TRACE_SPAN_NAME]: eventName,
          },
          span => {
            if (options) {
              span.addContext(
                prefixKeys("db.options", {
                  ...options,
                  session: undefined,
                })
              );
            }
            if (additionalContext) {
              span.addContext(prefixKeys("db", additionalContext(...populatedArgs)));
            }

            if (callback) {
              let wrapped_cb = api.bindFunctionToTrace(function(...cb_args) {
                api.finishSpan(span, eventName);
                return callback(...cb_args);
              });

              return original.apply(this, [...populatedArgs, wrapped_cb]);
            }

            let rv = original.apply(this, populatedArgs);
            if (typeof rv.then === "function") {
              // it's a promise?
              rv.then(
                () => {
                  api.finishSpan(span, eventName);
                },
                err => {
                  if (err) {
                    span.addContext({ error: err.toString() });
                  }
                  api.finishSpan(span, eventName);
                }
              );
              return rv;
            }

            // otherwise it's a cursor.  we don't do a good job of instrumenting
            // through cursor usage, but regardless this span is done.
            api.finishSpan(span, eventName);
            return rv;
          }
        );
      };
    });
  }

  // @return {Cursor}
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

  // @return {Promise} returns Promise if no callback passed
  wrap("insertOne", threeArgs, document => (opts.includeDocuments ? { document } : {}));

  // @return {Promise} returns Promise if no callback passed
  wrap("insertMany", threeArgs, documents =>
    opts.includeDocuments
      ? {
          documents,
          documents_count: documents.length,
        }
      : {}
  );
  // * @return {Promise} returns Promise if no callback passed
  wrap("bulkWrite", threeArgs, operations =>
    opts.includeDocuments && Array.isArray(operations)
      ? {
          operations,
          operations_count: operations.length,
        }
      : {}
  );
  // .insert is just a wrapper around .insertMany

  // * @return {Promise} returns Promise if no callback passed
  wrap("updateOne", fourArgs, (filter, update) => ({
    filter,
    update,
  }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("replaceOne", fourArgs, (filter, document) =>
    opts.includeDocuments
      ? {
          filter,
          document,
        }
      : {
          filter,
        }
  );
  // * @return {Promise} returns Promise if no callback passed
  wrap("updateMany", fourArgs, (filter, update) => ({
    filter,
    update,
  }));
  // * @return {Promise} returns Promise if no callback passed
  wrap("update", fourArgs, (selector, document) =>
    opts.includeDocuments
      ? {
          selector,
          document,
        }
      : {
          selector,
        }
  );

  // * @return {Promise} returns Promise if no callback passed
  wrap("deleteOne", threeArgs, filter => ({
    filter,
  }));
  // * @return {Promise} returns Promise if no callback passed
  wrap("deleteMany", threeArgs, filter => ({
    filter,
  }));
  // * @return {Promise} returns Promise if no callback passed
  wrap("remove", threeArgs, selector => ({
    selector,
  }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("save", threeArgs, document => (opts.includeDocuments ? { document } : {}));

  // * @return {Promise} returns Promise if no callback passed
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

  // * @return {Promise} returns Promise if no callback passed
  wrap("rename", threeArgs, newName => ({ newName }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("drop", twoArgs);

  // * @return {Promise} returns Promise if no callback passed
  wrap("options", twoArgs);

  // * @return {Promise} returns Promise if no callback passed
  wrap("isCapped", twoArgs);

  // * @return {Promise} returns Promise if no callback passed
  wrap("createIndex", threeArgs, fieldOrSpec => ({
    fieldOrSpec,
  }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("createIndexes", threeArgs, indexSpecs => ({
    indexSpecs,
  }));
  // * @return {Promise} returns Promise if no callback passed
  wrap(
    "dropIndex",
    (indexName, ...args) => {
      let callback = typeof args[args.length - 1] === "function" ? args.pop() : undefined;
      let options = args.length ? args.shift() || {} : {};
      return [indexName, options, callback];
    },
    indexName => ({ indexName })
  );

  // * @return {Promise} returns Promise if no callback passed
  wrap("dropIndexes", twoArgs);

  // * @return {Promise} returns Promise if no callback passed
  wrap("reIndex", twoArgs);

  // XXX(toshok) listIndexes doesn't take a callback, it returns a cursor
  // (ugggh)
  wrap("ensureIndex", threeArgs, fieldOrSpec => ({
    fieldOrSpec,
  }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("indexExists", threeArgs, indexes => ({ indexes }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("indexInformation", twoArgs);

  // * @return {Promise} returns Promise if no callback passed
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

  // * @return {Promise} returns Promise if no callback passed
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

  // * @return {Promise} returns Promise if no callback passed
  wrap("indexes", twoArgs);

  // * @return {Promise} returns Promise if no callback passed
  wrap("stats", twoArgs);

  // * @return {Promise} returns Promise if no callback passed
  wrap("findOneAndDelete", threeArgs, filter => ({ filter }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("findOneAndReplace", fourArgs, (filter, replacement) => ({
    filter,
    replacement,
  }));

  // * @return {Promise} returns Promise if no callback passed
  wrap("findOneAndUpdate", fourArgs, (filter, update) => ({
    filter,
    update,
  }));

  // * @return {Promise} returns Promise if no callback passed
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

  // * @return {Promise} returns Promise if no callback passed
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

  // * @return {AggregationCursor} returns AggregationCursor if no callback
  // passed
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

  // * @return {Promise} returns Promise if no callback passed
  wrap("parallelCollectionScan", (options, callback) => {
    if (typeof options === "function") (callback = options), (options = { numCursors: 1 });
    return [options, callback];
  });

  // * @return {Promise} returns Promise if no callback passed
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
