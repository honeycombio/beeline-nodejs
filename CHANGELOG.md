# beeline-nodejs changelog

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
