#!/usr/bin/env python3
import os
import sys
import json
import subprocess
from datetime import datetime

def update_nested_json(obj, key, new_value):
    if key in obj:
        obj[key] = new_value
    for k, v in obj.items():
        if isinstance(v, dict):
            update_nested_json(v, key, new_value)

def update_json(file, key, new_value):
    with open(file, 'r+') as f:
        data = json.load(f)
        update_nested_json(data, key, new_value)
        f.seek(0)
        json.dump(data, f, indent=4)
        f.truncate()

newv = sys.argv[1]
print(newv)

ci = os.path.realpath(os.path.dirname(sys.argv[0]))

update_json('package.json', 'version', newv)
update_json('src/plugin.json', 'version', newv)
update_json('src/plugin.json', 'updated', datetime.now().strftime('%Y-%m-%d'))

# Uncomment the following lines if you want to use git-cliff
# subprocess.run(['wget', '-c', 'https://github.com/orhun/git-cliff/releases/download/v0.7.0/git-cliff-0.7.0-x86_64-unknown-linux-musl.tar.gz'])
# subprocess.run(['tar', 'xvf', 'git-cliff-0.7.0-x86_64-unknown-linux-musl.tar.gz'])
# subprocess.run(['install', 'git-cliff-0.7.0/git-cliff', '/usr/bin/git-cliff'])

# subprocess.run(['git', 'cliff', '-t', f'v{newv}'], stdout=subprocess.DEVNULL)

subprocess.run(['git', 'config', 'user.email'], check=False) or subprocess.run(['git', 'config', 'user.email', 'github-actions@github.com'])
subprocess.run(['git', 'config', 'user.name'], check=False) or subprocess.run(['git', 'config', 'user.name', 'GitHub Actions [bot]'])

subprocess.run(['git', 'commit', '-a', '-m', f'chore(release): bump v{newv}'])
subprocess.run(['git', 'tag', f'v{newv}'])
