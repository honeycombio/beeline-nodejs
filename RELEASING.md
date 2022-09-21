# Releasing

- Use `npm version --no-git-tag-version` to update the version number using `major`, `minor`, `patch`, or the prerelease variants `premajor`, `preminor`, or `prepatch`.
  For example, to bump from v1.1.1 to the next patch version:

```shell
> npm version --no-git-tag-version patch # 1.1.1 -> 1.1.2
```

- Confirm the version number update appears in package.json and package-lock.json.
- Update `CHANGELOG.md` with the changes since the last release.
- Commit changes, push, and open a release preparation pull request for review.
- Once the pull request is merged, fetch the updated `main` branch.
- Apply a tag for the new version on the merged commit (e.g. `git tag -a v2.3.1 -m "v2.3.1"`)
- Push the tag upstream (this will kick off the release pipeline in CI) e.g. `git push origin v2.3.1`
- Copy change log entry for newest version into draft GitHub release created as part of CI publish steps. 
  - Make sure to "generate release notes" in github for full changelog notes and any new contributors
- Publish the github draft release and this will kick off publishing to GitHub and the NPM registry.
