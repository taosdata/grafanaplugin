#!/bin/sh

# Copyright (c) 2024 TAOS Data, Inc. <jhtao@taosdata.com>
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

if [ "${DEV}" = "false" ]; then
    echo "Starting test mode"
    exec /run.sh
fi

echo "Starting development mode"

if grep -i -q alpine /etc/issue; then
    exec /usr/bin/supervisord -c /etc/supervisord.conf
elif grep -i -q ubuntu /etc/issue; then
    exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
else
    echo 'ERROR: Unsupported base image'
    exit 1
fi

