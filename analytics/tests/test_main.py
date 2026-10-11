"""Tests for the CSQP analytics service skeleton (CSQP-6)."""

from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)


def test_health_reports_ok_and_dependencies():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "csqp-analytics"
    # pandas and reportlab must be installed (SAD 3.6)
    assert body["dependencies"]["pandas"]
    assert body["dependencies"]["reportlab"]


def test_ping_round_trip():
    res = client.get("/api/ping")
    assert res.status_code == 200
    assert res.json()["message"] == "pong"


def test_mock_student_summary_shape():
    res = client.get("/api/mock/students/s-101/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["studentId"] == "s-101"
    assert body["mock"] is True
    assert len(body["scoreTrend"]) > 0
    assert {"topic", "mastery", "status"} <= body["topics"][0].keys()


def test_mock_class_summary_shape():
    res = client.get("/api/mock/quizzes/quiz-7/class-summary")
    assert res.status_code == 200
    body = res.json()
    assert body["quizId"] == "quiz-7"
    assert 0 <= body["participationRate"] <= 1
    assert len(body["mostMissedQuestions"]) > 0


def test_internal_token_enforced_when_configured(monkeypatch):
    monkeypatch.setattr(config, "INTERNAL_API_TOKEN", "secret-123")

    missing = client.get("/api/ping")
    assert missing.status_code == 401
    assert missing.json()["success"] is False
    assert missing.json()["error"] == "UNAUTHORIZED"

    wrong = client.get("/api/ping", headers={"X-Internal-Token": "nope"})
    assert wrong.status_code == 401

    ok = client.get("/api/ping", headers={"X-Internal-Token": "secret-123"})
    assert ok.status_code == 200


def test_health_is_public_even_with_token(monkeypatch):
    monkeypatch.setattr(config, "INTERNAL_API_TOKEN", "secret-123")
    assert client.get("/health").status_code == 200
