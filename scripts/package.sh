#!/bin/sh
name=`jq '.id + "-" + .info.version' -r src/plugin.json`
echo generate plugin as $name
rm -rf $name
cp -r dist $name
zip -r $name.zip $name
echo packaged to $name.zip
