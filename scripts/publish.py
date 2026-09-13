#!/usr/bin/env python3
"""Validate and publish the current, explicitly synced public snapshot."""
from pathlib import Path
import subprocess
from datetime import datetime
ROOT = Path(__file__).resolve().parents[1]
def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)
run('npm', 'test')
run('npm', 'run', 'build')
branch = subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip()
if branch != 'main':
    raise SystemExit('请先切回 main 分支，再发布网站。')
run('git', 'add', 'public/data', 'public/media')
changed = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=ROOT).returncode
if changed:
    # This command publishes data only; source changes are reviewed and committed separately.
    staged = subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=ROOT, text=True).splitlines()
    if any(not name.startswith(('public/data/', 'public/media/')) for name in staged):
        raise SystemExit('暂存区还有网站代码改动，请先单独提交后再发布数据。')
    run('git', 'commit', '-m', f'content: sync prompt archive {datetime.now():%Y-%m-%d %H:%M}')
run('git', 'push', 'origin', 'main')
print('已推送。GitHub Actions 会构建并发布新版本；运行结果见仓库 Actions 页面。')
