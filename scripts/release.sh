#!/bin/bash
ci=$(realpath $(dirname $0))
newv=$1
if [ "$newv" = "" ]; then
  echo "$0 <version>"
  exit 1
fi
sed -Ei 's#"version":\s*.*$#"version": "'$newv'"#' package.json src/plugin.json
sed -Ei 's#"updated":\s*.*$#"updated": "'`date +%F`'"#' src/plugin.json
git cliff -t v$newv |tee CHANGELOG.md

