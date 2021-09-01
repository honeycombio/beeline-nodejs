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
- Apply a tag for the new version on the merged commit: vX.Y.Z, for example v1.1.2.
- Push the new version tag up to the project repository to kick off build and artifact publishing to GitHub and the NPM registry.
