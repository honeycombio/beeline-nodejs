# Honeycomb Beeline for NodeJS

[![CircleCI](https://circleci.com/gh/honeycombio/beeline-nodejs.svg?style=shield)](https://circleci.com/gh/honeycombio/beeline-nodejs)

This package makes it easy to instrument your Express/NodeJS application to send useful events to [Honeycomb](https://honeycomb.io), a service for debugging your software in production.

- [Usage and Examples](https://docs.honeycomb.io/getting-data-in/beelines/nodejs-beeline/)
- [API Reference](docs/API.md)

## Dependencies

- **Node 10+**

## Contributions

Features, bug fixes and other changes to `beeline-nodejs` are gladly accepted. Please
open issues or a pull request with your change. Remember to add your name to the
CONTRIBUTORS file!

All contributions will be released under the Apache License 2.0.

## Releasing new versions

Use `npm version --no-git-tag-version` to update the version number using `major`, `minor`, `patch`, or the prerelease variants `premajor`, `preminor`, or `prepatch`. We use `--no-git-tag-version` to avoid automatically tagging - tagging with the version automatically triggers a CI run that publishes, and we only want to do that upon merging the PR into `main`.

After doing this, follow our usual instructions for the actual process of tagging and releasing the package.

## Running postgresql tests locally

If you don't have postgresql running locally, you can launch postgresql in docker.

```
docker run -p 5432:5432 -e POSTGRES_USER=root circleci/postgres:9-alpine-ram
```

Then run the tests using

```
PGUSER=root PGDATABASE=postgres npm test
```
