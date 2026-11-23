"""Locate and run the GenVM linter on Windows or POSIX."""
import shutil
import site
import subprocess
import sys
from pathlib import Path

name = 'genvm-lint.exe' if sys.platform == 'win32' else 'genvm-lint'
candidates = [shutil.which(name), str(Path(site.getusersitepackages()).parent / 'Scripts' / name),
              str(Path(site.USER_BASE) / 'Scripts' / name),
              str(Path(sys.prefix) / 'Scripts' / name)]
binary = next((item for item in candidates if item and Path(item).is_file()), None)
if not binary:
    raise SystemExit('genvm-lint not found. Install requirements-dev.txt first.')
raise SystemExit(subprocess.call([binary, 'check', 'contracts/recusal.py', '--json']))
