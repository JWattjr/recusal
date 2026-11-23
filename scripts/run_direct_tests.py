"""Run GenLayer direct tests with Windows fd-0 cleanup compatibility."""
import atexit
import os
import pytest

real_unlink = os.unlink
pending = []


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
atexit.register(cleanup_pending)
raise SystemExit(pytest.main(['tests/direct', '-q']))
