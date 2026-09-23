/*
 * Copyright (c) 2024 TAOS Data, Inc. <jhtao@taosdata.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can use, redistribute, and/or modify
 * it under the terms of the GNU Affero General Public License, version 3
 * or later ("AGPL"), as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as webpack from 'webpack';

const PLUGIN_NAME = 'BuildModeWebpack';

export class BuildModeWebpackPlugin {
  apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        async () => {
          const assets = compilation.getAssets();
          for (const asset of assets) {
            if (asset.name.endsWith('plugin.json')) {
              const pluginJsonString = asset.source.source().toString();
              const pluginJsonWithBuildMode = JSON.stringify(
                {
                  ...JSON.parse(pluginJsonString),
                  buildMode: compilation.options.mode,
                },
                null,
                4
              );
              compilation.updateAsset(asset.name, new webpack.sources.RawSource(pluginJsonWithBuildMode));
            }
          }
        }
      );
    });
  }
}
