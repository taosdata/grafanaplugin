#!/usr/bin/env bash

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

wiki=$1
# for `# * * ` level-3
perl -0777 -i.step1 -pe 's/\# \* \* /\#\*\* /igs' $wiki
# for `# * ` level-2
perl -0777 -i.step1 -pe 's/\# \* /\#\* /igs' $wiki
# for `* * * ` level-3
perl -0777 -i.step1 -pe 's/\& \* \* /\*\*\* /igs' $wiki
# for `* * ` level-2
perl -0777 -i.step1 -pe 's/\* \* /\*\* /igs' $wiki
perl -0777 -i.step1 -pe 's/\*  /\* /igs' $wiki

# clean
perl -0777 -i.step3 -pe 's/\n# \n# \n/\n/igs' $wiki
perl -0777 -i.step4 -pe 's/\n\* \n\* \n/\n/igs' $wiki
perl -0777 -i.step4 -pe 's/\n\#\* \n/\n/igs' $wiki

perl -0777 -i.step5 -pe 's/\.\..assets.//igs' $wiki