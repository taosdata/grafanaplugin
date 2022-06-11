#!/bin/bash
ci=$(realpath $(dirname $0))
newv=$1
if [ "$newv" = "" ]; then
  echo "$0 <version>"
  exit 1
fi
sed -Ei 's#"version":\s*.*$#"version": "'$newv'"#' package.json src/plugin.json
sed -Ei 's#"updated":\s*.*$#"updated": "'`date +%F`'"#' src/plugin.json
git cliff -t v$newv |tee CHANGELOG.md > /dev/null

git config user.email "github-actions@github.com"
git config user.name "GitHub Actions [bot]"

git commit -a -m "chore(release): bump v$newv"

git push

git tag v$newv
git push origin v$newv:v$newv --force
