"""Run the StudioNet consensus cases with the installed gltest CLI."""
import shutil
import site
import subprocess
import sys
from pathlib import Path

name = 'gltest.exe' if sys.platform == 'win32' else 'gltest'
candidates = [shutil.which(name), str(Path(site.getusersitepackages()).parent / 'Scripts' / name),
              str(Path(site.USER_BASE) / 'Scripts' / name),
              str(Path(sys.prefix) / 'Scripts' / name)]
binary = next((item for item in candidates if item and Path(item).is_file()), None)
if not binary:
    raise SystemExit('gltest not found. Install requirements-dev.txt first.')
raise SystemExit(subprocess.call([binary, 'tests/integration', '-v', '-s', '--network', 'studionet']))
