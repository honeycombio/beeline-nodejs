# beeline-nodejs changelog

## 4.1.0 [2024-03-04]

### Enhancements

- feat: support classic ingest keys, upgrade to libhoney 4.2.0 (#726) | @cewkrupa 

### Maintenance

- ci: move nightly to weekly (#698) | @vreynolds
- maint: update codeowners to pipeline-team (#725) | @JamieDanielson
- maint: update codeowners to pipeline (#724) | @JamieDanielson
- docs: update readme (#689) | @vreynolds
- docs: add otel recommendation to readme (#673) | @pkanal
- docs: add note about requiring http (#655)
- chore: give dependabot PRs better title (#652) | @vreynolds
- ci: update validate PR title workflow (#645) | @pkanal
- ci: validate PR title (#644) | @pkanal
- maint: delete workflows for old board (#637) | @vreynolds
- maint: add release file (#636) | @vreynolds
- maint: add new project workflow (#634) | @vreynolds
- docs: developing with a local version of libhoney in the beeline's example application (#616) | @emilyashley
- maint(deps-dev): bump @typescript-eslint/eslint-plugin from 5.60.1 to 6.4.0 (#711)
- maint(deps-dev): bump prettier from 2.8.8 to 3.0.2 (#710)
- maint(deps-dev): bump jest from 29.5.0 to 29.6.2 (#709)
- maint(deps): bump @opentelemetry/core from 1.12.0 to 1.15.2 (#705)
- maint(deps): bump libhoney from 4.0.1 to 4.1.0 (#704)
- maint(deps-dev): bump pg-query-stream from 4.5.2 to 4.5.3 (#707)
- maint(deps-dev): bump eslint from 8.24.0 to 8.47.0 (#708)
- maint(deps-dev): bump fastify from 4.15.0 to 4.21.0 (#702)
- maint(deps-dev): bump pg-query-stream from 4.2.4 to 4.5.2 (#701)
- maint(deps-dev): bump semver from 7.5.2 to 7.5.4 (#700)
- maint(deps-dev): bump typescript from 4.8.4 to 5.1.6 (#693)
- maint(deps-dev): bump @typescript-eslint/parser from 5.57.0 to 5.62.0 (#703)
- maint(deps): bump word-wrap from 1.2.3 to 1.2.4 (#699)
- maint(deps-dev): bump @typescript-eslint/eslint-plugin from 5.42.0 to 5.60.1 (#692)
- maint(deps-dev): bump semver from 7.5.0 to 7.5.2 (#696)
- chore(deps): bump semver from 5.7.1 to 5.7.2 in /examples/node-tracing (#695)
- maint(deps): bump @opentelemetry/api from 1.2.0 to 1.4.1 (#685)
- maint(deps-dev): bump semver from 7.3.8 to 7.5.0 (#676)
- maint(deps): bump @opentelemetry/core from 1.9.1 to 1.12.0 (#679)
- maint(deps): bump libhoney from 4.0.0 to 4.0.1 (#678)
- maint(deps): bump vm2 from 3.9.17 to 3.9.18 (#680)
- maint(deps-dev): bump prettier from 2.8.7 to 2.8.8 (#675)
- maint(deps-dev): bump @typescript-eslint/parser from 5.54.0 to 5.57.0 (#669)
- maint(deps): bump vm2 from 3.9.16 to 3.9.17 (#672)
- maint(deps-dev): bump prettier from 2.7.1 to 2.8.7 (#665)
- maint(deps-dev): bump fastify from 4.10.2 to 4.15.0 (#668)
- maint(deps): bump vm2 from 3.9.15 to 3.9.16 (#671)
- maint(deps-dev): bump jest from 29.4.3 to 29.5.0 (#667)
- maint(deps): bump vm2 from 3.9.11 to 3.9.15 (#670)
- maint(deps): bump @opentelemetry/core from 1.7.0 to 1.9.1 (#659)
- maint(deps-dev): bump supertest from 6.3.0 to 6.3.3 (#653)
- maint(deps-dev): bump @typescript-eslint/parser from 5.39.0 to 5.54.0 (#663)
- maint(deps-dev): bump jest from 29.1.2 to 29.4.3 (#662)
- maint(deps-dev): bump express from 4.18.1 to 4.18.2 (#642)
- maint(deps): bump cookiejar from 2.1.3 to 2.1.4 (#658)
- maint(deps): bump json5 from 2.2.1 to 2.2.3 (#657)
- build(deps): bump qs from 6.5.2 to 6.5.3 in /examples/node-tracing (#650)
- build(deps): bump qs and formidable (#649)
- build(deps): bump express from 4.17.1 to 4.17.3 in /examples/node-tracing (#651)
- build(deps-dev): bump fastify from 4.8.1 to 4.10.2 (#643)
- build(deps-dev): bump @typescript-eslint/eslint-plugin from 5.39.0 to 5.42.0 (#640)
- Bump fastify from 4.7.0 to 4.8.1 (#635)
- Bump @typescript-eslint/eslint-plugin from 5.38.1 to 5.39.0 (#633)
- Bump semver from 7.3.7 to 7.3.8 (#632)
- Bump supertest from 6.2.4 to 6.3.0 (#631)
- Bump jest from 29.0.3 to 29.1.2 (#630)
- Bump @typescript-eslint/parser from 5.38.0 to 5.39.0 (#629)
- Bump typescript from 4.8.3 to 4.8.4 (#628)
- Bump eslint from 8.23.1 to 8.24.0 (#626)
- Bump fastify from 4.6.0 to 4.7.0 (#625)
- Bump @typescript-eslint/eslint-plugin from 5.38.0 to 5.38.1 (#624)

## 4.0.0 [2022-09-20]

### !!! Breaking Changes !!!

- Drop Node v12, no longer security supported (#614) | [@emilyashley](https://github.com/emilyashley)

### Maintenance

- maint: add node 18 to CI matrix (#610) | [@vreynolds](https://github.com/vreynolds)
- maint: make sure ci uses node matrix (#607) | [@vreynolds](https://github.com/vreynolds)
- Bump jest from 28.1.3 to 29.0.3 (#622)
- Bump fastify from 3.29.2 to 4.6.0 (#621)
- Bump @opentelemetry/core from 1.6.0 to 1.7.0 (#620)
- Bump @typescript-eslint/eslint-plugin from 5.37.0 to 5.38.0 (#619)
- Bump @typescript-eslint/parser from 5.37.0 to 5.38.0 (#618)
- Bump @typescript-eslint/eslint-plugin from 5.30.0 to 5.31.0 (#609)
- Bump eslint from 8.14.0 to 8.20.0 (#604)
- Bump @typescript-eslint/eslint-plugin from 5.27.0 to 5.30.0 (#600)
- Bump typescript from 4.7.3 to 4.7.4 (#599)
- Bump typescript from 4.6.4 to 4.7.3 (#598)
- Bump @typescript-eslint/eslint-plugin from 5.22.0 to 5.27.0 (#596)
- Bump @opentelemetry/core from 1.2.0 to 1.3.0 (#595)
- Bump jest from 28.0.3 to 28.1.0 (#594)
- Bump @typescript-eslint/parser from 5.22.0 to 5.27.0 (#593)

## 3.4.0 [2022-05-04]

### Enhancements

- Add meta.span_type to root/subroot spans (#576) | [@MikeGoldsmith](https://github.com/MikeGoldsmith)

### Fixes

- Make api.addContext work in impl:mock mode (#557) | [@glenjamin](https://github.com/glenjamin)

### Maintenance

- maint: remove lint-staged (#566) | [@vreynolds](https://github.com/vreynolds)
- Bump jest from 27.5.1 to 28.0.3 (#583)
- Bump @opentelemetry/api from 1.0.4 to 1.1.0 (#590)
- Bump @typescript-eslint/eslint-plugin from 5.18.0 to 5.22.0 (#591)
- Bump eslint from 8.13.0 to 8.14.0 (#589)
- Bump react-dom from 18.0.0 to 18.1.0 (#587)
- Bump react from 18.0.0 to 18.1.0 (#586)
- Bump libhoney from 3.1.0 to 3.1.1 (#585)
- Bump express from 4.17.3 to 4.18.1 (#588)
- Bump @typescript-eslint/parser from 5.18.0 to 5.22.0 (#584)
- Bump supertest from 6.2.2 to 6.2.3 (#580)
- Bump typescript from 4.6.3 to 4.6.4 (#581)
- Bump fastify from 3.28.0 to 3.29.0 (#579)
- Bump @typescript-eslint/parser from 5.18.0 to 5.21.0 (#578)
- Bump @opentelemetry/core from 1.0.1 to 1.2.0 (#577)
- Bump react and react-dom (#570)
- Bump typescript from 4.5.4 to 4.6.3 (#574)
- Bump minimist from 1.2.5 to 1.2.6 in /examples/node-tracing (#560)
- Bump libhoney from 3.0.0 to 3.1.0 (#571)
- Bump pg-query-stream from 4.2.1 to 4.2.3 (#572)
- Bump prettier from 2.5.1 to 2.6.2 (#573)
- Bump fastify from 3.25.3 to 3.28.0 (#569)
- Bump express from 4.17.2 to 4.17.3 (#568)
- Bump semver from 7.3.5 to 7.3.6 (#567)
- Bump debug from 4.3.3 to 4.3.4 (#563)
- Bump supertest from 6.1.6 to 6.2.2 (#536)
- Bump @typescript-eslint/parser from 5.9.0 to 5.18.0 (#564)
- Bump pg from 8.7.1 to 8.7.3 (#565)
- Bump jest from 27.4.3 to 27.5.1 (#549)
- Bump @typescript-eslint/eslint-plugin from 5.17.0 to 5.18.0 (#561)
- Bump eslint from 8.3.0 to 8.13.0 (#562)
- Bump @typescript-eslint/eslint-plugin from 5.9.0 to 5.17.0 (#559)
- Bump minimist from 1.2.5 to 1.2.6 (#556)

## 3.3.0 [2022-03-21]

### Enhancements

- Add Environment & Services support (#551) | [@MikeGoldsmith](https://github.com/MikeGoldsmith)

### Maintenance

- docs: add note about ESM (#542) | [@vreynolds](https://github.com/vreynolds)
- Bump vm2 from 3.9.5 to 3.9.7 (#543) | [@dependabot](https://github.com/dependabot)

## 3.2.2 [2022-01-19]

### Fixes

- Fix parser defaults (#533) | [@vreynolds](https://github.com/vreynolds)

### Maintenance

- Update vulnerable dependencies (#532) | [@vreynolds](https://github.com/vreynolds)

## 3.2.1 [2022-01-06]

### Fixes

- Check parent exists during instrumentation (#525) | [Asgaroth](https://github.com/Asgaroth)
- Use beforeEach() and afterEach() in tests (#524) | [@JamieDanielson](https://github.com/JamieDanielson)

### Maintenance

- Bump typescript from 4.5.2 to 4.5.4 (#526)
- Bump @typescript-eslint/parser from 5.6.0 to 5.9.0 (#527)
- Bump lint-staged from 12.1.2 to 12.1.5 (#528)
- Bump @typescript-eslint/eslint-plugin from 5.6.0 to 5.9.0 (#529)
- Bump fastify from 3.24.1 to 3.25.3 (#522)
- Bump @opentelemetry/api from 1.0.3 to 1.0.4 (#521)
- Bump express from 4.17.1 to 4.17.2 (#523)
- Add re-triage workflow (#517) | [@vreynolds](https://github.com/vreynolds)

## 3.2.0 [2021-12-22]

### Improvements

- feat: accept both w3c and honeycomb propagation headers by default (#514) | [@JamieDanielson](https://github.com/JamieDanielson)
- Further improvements to typescript types (#509) | [@glenjamin](https://github.com/glenjamin)

### Maintenance

- add docker-compose config for test-worthy Postgres (#515) | [@robbkidd](https://github.com/robbkidd)
- Bump debug from 4.3.2 to 4.3.3 (#505) | [@dependabot](https://github.com/dependabot)
- Bump jest from 27.3.1 to 27.4.3 (#512) | [@dependabot](https://github.com/dependabot)
- Bump fastify from 3.24.0 to 3.24.1 (#506) | [@dependabot](https://github.com/dependabot)
- Add npm shield with link to npm package (#513) | [@JamieDanielson](https://github.com/JamieDanielson)
- Bump prettier from 2.4.1 to 2.5.1 (#511) | [@dependabot](https://github.com/dependabot)
- maint: Enable linting for ts files (to lint types file) (#510) | [@JamieDanielson](https://github.com/JamieDanielson)

## 3.1.0 [2021-12-06]

### Improvements

- Expand type definitions to include all libhoney options (#502) | [@glenjamin](https://github.com/glenjamin)

### Maintenance

- Update dependabot to monthly (#500) | [@vreynolds](https://github.com/vreynolds)
- Add node 17 to test matrix (#485) | [@vreynolds](https://github.com/vreynolds)
- Remove unnecessary dependency on node types (#484) | [@vreynolds](https://github.com/vreynolds)
- Migrate and update example from examples repo (#494) | [@JamieDanielson](https://github.com/JamieDanielson)
- Empower apply-labels action to apply labels (#490) | [@robbkidd](https://github.com/robbkidd)

### Dependencies

- Bump lint-staged from 12.1.1 to 12.1.2 (#501)
- Bump fastify from 3.22.1 to 3.24.0 (#497)
- Bump @opentelemetry/core from 1.0.0 to 1.0.1 (#496)
- Bump lint-staged from 11.2.4 to 12.1.1 (#498)
- Bump eslint from 8.1.0 to 8.3.0 (#499)
- Bump lint-staged from 11.2.3 to 11.2.4 (#487)
- Bump eslint from 8.0.1 to 8.1.0 (#488)
- Bump libhoney from 2.3.3 to 3.0.0 (#478)
- Bump @opentelemetry/core from 0.25.0 to 1.0.0 (#467)
- Bump eslint from 7.32.0 to 8.0.1 (#474)
- Bump husky from 7.0.2 to 7.0.4 (#483)
- Bump lint-staged from 11.1.2 to 11.2.3 (#482)
- Bump jest from 27.3.0 to 27.3.1 (#480)
- Bump fastify from 3.21.6 to 3.22.1 (#479)
- Bump jest from 27.2.2 to 27.3.0 (#476)

## 3.0.0 [2021-10-14]

### !!! Breaking Changes !!!

- Remove deprecated APIs (#457) | [@vreynolds](https://github.com/vreynolds)
  - `marshalTraceContext()` --> use provider-specific functions, e.g. `honeycomb.marshalTraceContext()`
  - `unmarshalTraceContext()` --> use provider-specific functions, e.g. `honeycomb.unmarshalTraceContext()`
  - `TRACE_HTTP_HEADER` --> use provider-specific constants, e.g. `honeycomb.TRACE_HTTP_HEADER`
  - `AMAZON_TRACE_HTTP_HEADER` --> use `aws.TRACE_HTTP_HEADER`
  - `removeContext()` --> no replacement
  - `customContext.add()` --> use `addTraceContext()`
  - `customContext.remove()` --> no replacement
- Stop auto-detecting x-request-id and amazon trace headers (#445) | [@vreynolds](https://github.com/vreynolds)
  - Users will have to opt-in to custom trace propagation
- Fix api.addContext so it works on the current span (not the root) (#347) | [@ajvondrak](https://github.com/ajvondrak)
  - This is a fix to match documentation and intention, but breaks current (incorrect) behavior.

### Maintenance

- Clean up npm tarball (#465) | [@vreynolds](https://github.com/vreynolds)
- Change maintenance badge to maintained (#459)
- Adds Stalebot (#460)
- Bump @types/node from 16.9.4 to 16.10.2 (#466)
- Bump @opentelemetry/core from 0.24.0 to 0.25.0 (#464)
- Bump fastify from 3.21.3 to 3.21.6 (#461)
- Bump jest from 27.2.0 to 27.2.2 (#462)
- Bump fastify from 3.21.0 to 3.21.3 (#452)
- Bump jest from 27.1.1 to 27.2.0 (#453)
- Bump libhoney from 2.3.2 to 2.3.3 (#454)
- Bump @types/node from 16.9.1 to 16.9.4 (#456)
- Bump prettier from 2.4.0 to 2.4.1 (#455)

## 2.8.1 [2021-09-16]

### Fixes

- Fix types on bindFunctionToTrace (#450).
  - Thanks [@gmunguia](https://github.com/gmunguia) and [@zenazn](https://github.com/zenazn) for raising the issue.

### Maintenance

- Update deprecation comments (#444) [@vreynolds](https://github.com/vreynolds)
- Add engines to package.json (#443)
- Add NOTICE (#442)
- Bump prettier from 2.3.2 to 2.4.0 (#446)
- Bump jest from 27.0.6 to 27.1.1 (#447)
- Bump @types/node from 16.7.1 to 16.9.1 (#449)
- Bump fastify from 3.20.2 to 3.21.0 (#448)
- Bump @opentelemetry/api from 1.0.2 to 1.0.3 (#440)

## 2.8.0 [09-01-2021]

### Improvements

- Support esbuild (#415) [@markandrus](https://github.com/markandrus)
  - **Note:** The use of any JavaScript bundler will prevent the use of the majority of Beeline auto-instrumentations.
    The Beeline's API can still be used for generating traces manually for your own application logic.

### Maintenance

- Bump @opentelemetry/core from 0.18.0 to 0.24.0 (#414)
- Bump pg-query-stream from 4.1.0 to 4.2.1 (#430)
- Bump husky from 6.0.0 to 7.0.2 (#431)
- Bump supertest from 6.1.3 to 6.1.6 (#432)
- Bump libhoney from 2.3.0 to 2.3.2 (#435)
- Bump eslint from 7.30.0 to 7.32.0 (#434)
- Bump pg from 8.6.0 to 8.7.1 (#433)
- Bump lint-staged from 11.0.0 to 11.1.2 (#416)
- Bump fastify from 3.15.1 to 3.20.2 (#426)
- Bump @types/node from 16.3.2 to 16.7.1 (#428)
- Bump jest from 27.0.4 to 27.0.6 (#388)
- Bump debug from 4.3.1 to 4.3.2 (#404)

## 2.7.5 [07-23-2021]

### Fixes

- Use JSON.stringify only when debugging is enabled [#401](https://github.com/honeycombio/beeline-nodejs/pull/401) | [@kamilkisiela](https://github.com/kamilkisiela)

### Maintenance

- Bump eslint from 7.29.0 to 7.30.0 (#398)
- Bump @types/node from 15.12.4 to 16.3.2 (#403)
- Bump prettier from 2.3.1 to 2.3.2 (#382)

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
