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

FROM golang:1.17.2 as builder
LABEL maintainer "Linhe Huo <linhe.huo@gmail.com"

WORKDIR /usr/src/webhook
COPY ./ /usr/src/webhook/
ENV GOPROXY=https://goproxy.cn,direct
RUN go mod tidy && go build

FROM ubuntu:20.04
COPY --from=builder /usr/src/webhook/webhook /usr/local/bin/
VOLUME [ "/etc/taos/" ]
EXPOSE 9010
CMD ["webhook"]
