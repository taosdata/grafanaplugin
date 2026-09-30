#!/bin/bash

# Copyright (c) 2022 TAOS Data, Inc. <jhtao@taosdata.com>
#
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# This program is free software: you can use, redistribute, and/or modify
# it under the terms of the GNU Affero General Public License, version 3
# or later ("AGPL"), as published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

ci=$(realpath $(dirname $0))
newv=$1
if [ "$newv" = "" ]; then
  echo "$0 <version>"
  exit 1
fi
sed -Ei 's#"version":\s*.*$#"version": "'$newv'",#' package.json src/plugin.json
sed -Ei 's#"updated":\s*.*$#"updated": "'`date +%F`'"#' src/plugin.json

# command -v git-cliff > /dev/null || \
#   (wget -c https://github.com/orhun/git-cliff/releases/download/v0.7.0/git-cliff-0.7.0-x86_64-unknown-linux-musl.tar.gz && \
#     tar xvf git-cliff-0.7.0-x86_64-unknown-linux-musl.tar.gz && \
#     install git-cliff-0.7.0/git-cliff /usr/bin/git-cliff)

# git cliff -t v$newv |tee CHANGELOG.md > /dev/null

git config user.email || git config user.email "github-actions@github.com"
git config user.name || git config user.name "GitHub Actions [bot]"

git commit -a -m "chore(release): bump v$newv"
git tag v$newv
