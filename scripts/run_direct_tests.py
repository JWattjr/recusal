"""Run GenLayer direct tests with Windows fd-0 cleanup compatibility."""
import atexit
import os
import sys
from functools import lru_cache

import pytest
from genvm_linter.validate.artifacts import resolve_artifact_source
from genvm_linter.validate.sdk_loader import extract_sdk_paths, parse_contract_header
from gltest.direct import sdk_loader

real_unlink = os.unlink
pending = []


@lru_cache(maxsize=1)
def pinned_sdk_paths(contract_path):
    # gltest's legacy downloader cannot read the current GenVM release layout.
    # Resolve the exact dependency hash from the contract using the linter's loader.
    os.environ.setdefault('GENVM_VERSION', 'v0.6.0-rc17')
    artifact = resolve_artifact_source()
    paths, _ = extract_sdk_paths(artifact, parse_contract_header(contract_path))
    for path in reversed(paths):
        source = path / 'src'
        sys.path.insert(0, str(source if source.is_dir() else path))
    return paths


def setup_sdk_paths(contract_path, version=None):
    paths = pinned_sdk_paths(contract_path)
    # Each direct fixture models a separate VM; the SDK module stays loaded in pytest.
    contracts = sys.modules.get('genlayer.gl.genvm_contracts')
    if contracts is not None:
        contracts.__known_contract__ = None
    return paths


def unlink_after_fd_release(path, *args, **kwargs):
    try:
        return real_unlink(path, *args, **kwargs)
    except PermissionError:
        pending.append(path)
        return None


def cleanup_pending():
    try:
        os.close(0)
    except OSError:
        pass
    for path in pending:
        try:
            real_unlink(path)
        except OSError:
            pass


os.unlink = unlink_after_fd_release
sdk_loader.setup_sdk_paths = setup_sdk_paths
atexit.register(cleanup_pending)
raise SystemExit(pytest.main(['tests/direct', '-q']))
