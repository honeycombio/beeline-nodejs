# Honeycomb Beeline for NodeJS

[![OSS Lifecycle](https://img.shields.io/osslifecycle/honeycombio/beeline-nodejs?color=success)](https://github.com/honeycombio/home/blob/main/honeycomb-oss-lifecycle-and-practices.md)
[![CircleCI](https://circleci.com/gh/honeycombio/beeline-nodejs.svg?style=shield)](https://circleci.com/gh/honeycombio/beeline-nodejs)
[![npm](https://img.shields.io/npm/v/honeycomb-beeline)](https://www.npmjs.com/package/honeycomb-beeline)

**STATUS**: This project is being Sunset. See [this issue](https://github.com/honeycombio/beeline-java/issues/322) for more details.

⚠️**Note**: Beelines are Honeycomb's legacy instrumentation libraries. We embrace OpenTelemetry as the effective way to instrument applications. For any new observability efforts, we recommend [instrumenting with OpenTelemetry](https://docs.honeycomb.io/send-data/javascript-nodejs/opentelemetry-sdk/).

This package makes it easy to instrument your Express/NodeJS application to send useful events to [Honeycomb](https://honeycomb.io), a service for debugging your software in production.

- [Usage and Examples](https://docs.honeycomb.io/getting-data-in/beelines/nodejs-beeline/)
- [API Reference](docs/API.md)

## Dependencies

- **Node 14.18+**

## Known Issues

- Using a bundler (esbuild, webpack, etc.) or ESM with the Beeline is unsupported. You may be able to use the Beeline in those cases, but auto-instrumentations will likely not work.

- An error like `'api.traceActive is not a function' error` may occur for some auto-instrumentation and can be resolved by manually requiring `https` before requiring other libraries such as `request-promise`.

## Contributions

Features, bug fixes and other changes to `beeline-nodejs` are gladly accepted. Please
open issues or a pull request with your change. Remember to add your name to the
CONTRIBUTORS file!

All contributions will be released under the Apache License 2.0.

## Running postgresql tests locally

If you don't have postgresql running locally, you can launch postgresql in docker.

```
docker run -p 5432:5432 -e POSTGRES_USER=root circleci/postgres:9-alpine-ram
```

Then run the tests using

```
PGUSER=root PGDATABASE=postgres npm test
```
