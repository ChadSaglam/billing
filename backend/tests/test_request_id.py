"""Every response carries X-Request-ID; a caller-supplied one is echoed (4.1)."""

import logging

from app.logging_config import RequestIdFilter, request_id_var


def test_request_id_is_generated(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert len(resp.headers["X-Request-ID"]) == 32


def test_incoming_request_id_is_echoed(client):
    resp = client.get("/api/health", headers={"X-Request-ID": "trace-abc-123"})
    assert resp.headers["X-Request-ID"] == "trace-abc-123"


def test_log_records_carry_request_id():
    record = logging.LogRecord("t", logging.INFO, __file__, 1, "msg", None, None)
    assert RequestIdFilter().filter(record) and record.request_id == "-"
    token = request_id_var.set("req-1")
    try:
        RequestIdFilter().filter(record)
        assert record.request_id == "req-1"
    finally:
        request_id_var.reset(token)
