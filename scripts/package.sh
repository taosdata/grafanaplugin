#!/bin/sh

# Copyright (c) 2021 TAOS Data, Inc. <jhtao@taosdata.com>
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

name=`jq '.id' -r src/plugin.json`
zipname=`jq '.id + "-" + .info.version + ".zip"' -r src/plugin.json`
echo generate plugin as $name
rm -rf $name
cp -r dist $name
zip -r $zipname $name
echo packaged to $zipname
