# beeline-nodejs changelog

## 2.7.3 [07-08-2021]

### Fixes

- Add impl type to BeelineOpts TypeScript definition [#389](https://github.com/honeycombio/beeline-nodejs/pull/389) | [@Cameron485](https://github.com/Cameron485)

## 2.7.2 [06-25-2021]

### Fixes

- Fix: http(s) instrumentation URL arg. (#361) | [@vreynolds](https://github.com/vreynolds)

### Improvements

- Make sampleRate optional in the interface. (#379) | [@Thom-netexpo](https://github.com/Thom-netexpo)

## 2.7.1 [06-02-2021]

### Improvements

- Make api.withTrace's type signature match api.startTrace (#348) | [@ajvondrak](https://github.com/ajvondrak)
- Ensure beeline can be import-ed or require-d when using typescript (#352) | [@vreynolds](https://github.com/vreynolds)

### Maintenance

- Bump lint-staged from 10.5.4 to 11.0.0 (#356)
- Bump pg from 8.5.1 to 8.6.0 (#344)
- Bump @types/node from 14.14.25 to 15.3.0 (#354)
- Bump pg-query-stream from 4.0.0 to 4.1.0 (#342)
- Bump fastify from 3.14.1 to 3.15.1 (#353)
- Bump eslint from 7.23.0 to 7.26.0 (#350)
- Bump prettier from 2.2.1 to 2.3.0 (#357)

## 2.7.0 [04-28-2021]

### Improvements

- TypeScript definitions (#308) | [@antonvasin](https://github.com/antonvasin)

### Fixes

- Add missing quotes to CustomContext.md (#321) | [@mmalecki](https://github.com/mmalecki)
- transmission is a property of libhoney, but if not declared we cannot pass it from typescript (#339) | [@ilbambino](https://github.com/ilbambino)

### Maintenance

- Bump react-dom from 17.0.1 to 17.0.2 (#334)
- Bump @opentelemetry/core from 0.18.0 to 0.18.2 (#333)
- Bump react from 17.0.1 to 17.0.2 (#332)
- Bump husky from 5.2.0 to 6.0.0 (#331)
- Bump fastify from 3.14.0 to 3.14.1 (#328)
- Bump semver from 7.3.4 to 7.3.5 (#327)
- Bump libhoney from 2.2.1 to 2.2.3 (#326)
- Bump eslint from 7.22.0 to 7.23.0 (#325)
- Bump husky from 5.1.3 to 5.2.0 (#323)
- Bump fastify from 3.12.0 to 3.14.0 (#320)
- Bump eslint from 7.19.0 to 7.22.0 (#319)
- Bump @opentelemetry/core from 0.16.0 to 0.18.0 (#317)
- Bump husky from 4.3.8 to 5.1.3 (#316)
- Bump fastify from 3.11.0 to 3.12.0 (#311)
- Bump lint-staged from 10.5.3 to 10.5.4 (#306)
- Bump @opentelemetry/core from 0.15.0 to 0.16.0 (#305)
- Bump eslint from 7.18.0 to 7.19.0 (#304)
- Toshok no longer has a branch for that (kidding, he totally has a branch for that) (#303)
- Bump supertest from 6.1.1 to 6.1.3 (#302)
- Bump fastify from 3.10.1 to 3.11.0 (#301)
- Bump prettier from 2.1.2 to 2.2.1 (#300)
- Bump @opentelemetry/core from 0.12.0 to 0.15.0 (#299)

## 2.6.0

### Improvements

- Use the non-deprecated request.raw attribute (#288)
- Add trace hooks API docs (#286)
- Add interop docs to API.md (#254)
- Add syntax highlighting to docs/CustomContext.md (#273)

### Fixes

- Ensure fastify intrumentation honors the httpParserHook config (#287)
- http(s) instrumentation should output urls with path/pathname/query correctly (#210)
- Handle pg pool clients (#272)

### Maintenance

- Add dependabot to check monthly and update intgrations team (#274)
- Add node 15 to CI matrix (#294)
- User public ENV context in circleci (#268)
- Bump fastify from 3.7.0 to 3.10.1 (#291)
- Bump eslint from 7.17.0 to 7.18.0 (#292)
- Bump husky from 4.3.7 to 4.3.8 (#293)
- Bump supertest from 6.0.1 to 6.1.1 (#289)
- Bump lint-staged from 8.1.5 to 10.5.3 (#290)
- Bump pg-query-stream from 2.0.1 to 4.0.0 (#275)
- Bump react from 17.0.0 to 17.0.1 (#281)
- Bump husky from 4.3.6 to 4.3.7 (#284)
- Bump semver from 7.3.2 to 7.3.4 (#283)
- Bump debug from 4.2.0 to 4.3.1 (#282)
- Bump supertest from 5.0.0 to 6.0.1 (#280)
- Bump pg from 7.14.0 to 8.5.1 (#277)
- Bump jest from 26.6.0 to 26.6.3 (#276)
- Bump eslint from 7.11.0 to 7.17.0 (#278)
- Bump husky from 1.3.1 to 4.3.6 (#279)
- Bump node-notifier from 8.0.0 to 8.0.1 (#270)
- Bump find-my-way from 3.0.4 to 3.0.5 (#266)

## 2.5.0

Improvements:

- Alays return valid parent context when creating span #262
- Add default object value when configuring beeline #258
- Support fastify v3 #263

Maintenance:

- Update dependencies #259 & #260

## 2.4.0

- Introduces configuration options for parsing and propagating HTTP trace context headers (#249).
- Added prebuilt hooks for use with parse and propagation hooks that handle aws, w3c and honeycomb header formats. (#253)

## 2.3.1

### Misc

- Added CHANGELOG.md
- Updates to CI configuration and documentation
- Updated version management.
