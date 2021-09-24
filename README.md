# Honeycomb Beeline for NodeJS

[![OSS Lifecycle](https://img.shields.io/osslifecycle/honeycombio/beeline-nodejs?color=success)](https://github.com/honeycombio/home/blob/main/honeycomb-oss-lifecycle-and-practices.md)
[![CircleCI](https://circleci.com/gh/honeycombio/beeline-nodejs.svg?style=shield)](https://circleci.com/gh/honeycombio/beeline-nodejs)

This package makes it easy to instrument your Express/NodeJS application to send useful events to [Honeycomb](https://honeycomb.io), a service for debugging your software in production.

- [Usage and Examples](https://docs.honeycomb.io/getting-data-in/beelines/nodejs-beeline/)
- [API Reference](docs/API.md)

## Dependencies

- **Node 10+**

## Known Issues

- Using a bundler (esbuild, webpack, etc.) with the Beeline is unsupported. You may be able to use the Beeline with a bundler, but auto-instrumentations will likely not work.

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
