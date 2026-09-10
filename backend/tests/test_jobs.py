"""Scheduled jobs runner (R-84): in-API loop vs. dedicated worker."""
import os
import pathlib
import subprocess
import sys

from fastapi.testclient import TestClient

import app.jobs as jobs_cli
import app.main as main_module
from app.config import settings

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]


def test_lifespan_runs_jobs_in_api_by_default(monkeypatch):
    calls = []
    monkeypatch.setattr(settings, "RUN_JOBS_IN_API", True)
    monkeypatch.setattr(main_module, "run_scheduled_jobs", lambda db, source: calls.append(source))

    async def _no_loop():
        return None

    monkeypatch.setattr(main_module, "background_jobs_loop", _no_loop)
    with TestClient(main_module.app):
        pass
    assert calls == ["startup"]


def test_lifespan_skips_jobs_when_disabled(monkeypatch):
    calls = []
    monkeypatch.setattr(settings, "RUN_JOBS_IN_API", False)
    monkeypatch.setattr(main_module, "run_scheduled_jobs", lambda db, source: calls.append(source))

    async def _fail():
        raise AssertionError("background loop must not start")

    monkeypatch.setattr(main_module, "background_jobs_loop", _fail)
    with TestClient(main_module.app):
        pass
    assert calls == []


def test_jobs_cli_once_runs_one_pass_and_exits(monkeypatch):
    calls = []
    monkeypatch.setattr(jobs_cli, "run_jobs_once", lambda source: calls.append(source))
    assert jobs_cli.main(["--once"]) == 0
    assert calls == ["jobs-once"]


def test_jobs_cli_once_subprocess_exits_zero(engine):
    """`python -m app.jobs --once` against the migrated test database."""
    env = {**os.environ, "DATABASE_URL": str(engine.url.render_as_string(hide_password=False))}
    proc = subprocess.run(
        [sys.executable, "-m", "app.jobs", "--once"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 0, proc.stderr
    assert "scheduled jobs failed" not in proc.stderr + proc.stdout
