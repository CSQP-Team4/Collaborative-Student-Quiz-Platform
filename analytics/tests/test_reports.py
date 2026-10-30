"""Tests for PDF / CSV report export (CSQP-30 / TC-Perf-04).

"Exported file matches the on-screen data": each test compares the export
with the JSON summary endpoint that the dashboards display.
"""

import csv
import io

from fastapi.testclient import TestClient
from pypdf import PdfReader

from app import config
from app.main import app
from tests.test_class_summary import ATTEMPTS as CLASS_ATTEMPTS
from tests.test_class_summary import QUIZZES
from tests.test_student_summary import ATTEMPTS as STUDENT_ATTEMPTS

client = TestClient(app)

STUDENT_BODY = {"studentId": "s-1", "studentName": "Asha Rao", "attempts": STUDENT_ATTEMPTS}
CLASS_BODY = {"totalStudents": 5, "instructorName": "Prof Rao", "quizzes": QUIZZES, "attempts": CLASS_ATTEMPTS}


def csv_sections(content: bytes) -> dict[str, list[dict]]:
    """Split our multi-table CSV back into {section title: rows}."""
    text = content.decode("utf-8-sig")
    sections: dict[str, list[dict]] = {}
    for block in text.strip().split("\n\n"):
        title, _, table = block.partition("\n")
        sections[title.strip()] = list(csv.DictReader(io.StringIO(table)))
    return sections


def pdf_text(content: bytes) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(content)).pages)


def test_student_csv_matches_dashboard_numbers():
    screen = client.post("/api/students/summary", json=STUDENT_BODY).json()
    res = client.post("/api/reports/student?format=csv", json=STUDENT_BODY)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert res.headers["content-disposition"].startswith('attachment; filename="csqp-my-progress-')
    assert res.headers["content-disposition"].endswith('.csv"')

    sections = csv_sections(res.content)
    overview = sections["Summary"][0]
    assert overview["Student"] == "Asha Rao"
    assert int(overview["Quizzes completed"]) == screen["attemptsCompleted"]
    assert float(overview["Average score (%)"]) == screen["averageScore"]
    assert [r["Quiz"] for r in sections["Quiz history"]] == [h["quizTitle"] for h in screen["history"]]
    assert [float(r["Percentage"]) for r in sections["Quiz history"]] == [h["percentage"] for h in screen["history"]]
    assert [r["Topic"] for r in sections["Topics"]] == [t["topic"] for t in screen["topics"]]
    assert sections["Topics"][-1]["Status"] == "Needs work"


def test_student_pdf_is_a_real_pdf_with_the_same_data():
    screen = client.post("/api/students/summary", json=STUDENT_BODY).json()
    res = client.post("/api/reports/student?format=pdf", json=STUDENT_BODY)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")

    text = pdf_text(res.content)
    assert "Student performance report" in text
    assert "Asha Rao" in text
    assert f"{screen['averageScore']:g}%" in text
    assert "Study next: Graphs" in text
    for h in screen["history"]:
        assert h["quizTitle"] in text


def test_pdf_is_the_default_format():
    res = client.post("/api/reports/student", json=STUDENT_BODY)
    assert res.headers["content-type"] == "application/pdf"


def test_student_report_with_no_attempts():
    body = {"studentId": "s-1", "studentName": "New Student", "attempts": []}
    assert "No quizzes completed yet." in pdf_text(client.post("/api/reports/student", json=body).content)
    sections = csv_sections(client.post("/api/reports/student?format=csv", json=body).content)
    assert sections["Quiz history"] == []


def test_class_csv_matches_dashboard_numbers():
    screen = client.post("/api/quizzes/class-summary", json=CLASS_BODY).json()
    res = client.post("/api/reports/class?format=csv", json=CLASS_BODY)
    assert res.status_code == 200
    sections = csv_sections(res.content)

    quiz = sections["Quizzes"][0]
    on_screen = screen["quizzes"][0]
    assert quiz["Quiz"] == on_screen["title"]
    assert float(quiz["Average score (%)"]) == on_screen["averageScore"]
    assert int(quiz["Participants"]) == on_screen["participants"]
    assert int(quiz["Participation (%)"]) == round(on_screen["participationRate"] * 100)
    assert sections["Quizzes"][1]["Participants"] == "0"

    missed = sections["Most-missed questions"]
    assert [r["Question"] for r in missed] == [m["text"] for m in on_screen["mostMissedQuestions"]]
    assert [int(r["Missed"]) for r in missed] == [m["missed"] for m in on_screen["mostMissedQuestions"]]


def test_class_pdf_contains_each_quiz():
    res = client.post("/api/reports/class?format=pdf", json=CLASS_BODY)
    text = pdf_text(res.content)
    assert "Class analytics report" in text and "Prof Rao" in text
    assert "Trees and Graphs" in text and "75%" in text and "3 of 5" in text
    assert "No students have submitted this quiz yet." in text


def test_special_characters_are_escaped_in_pdf():
    body = dict(STUDENT_BODY, studentName="A <b>&</b> B")
    res = client.post("/api/reports/student", json=body)
    assert res.status_code == 200
    assert "A <b>&</b> B" in pdf_text(res.content)


def test_rejects_unknown_format():
    assert client.post("/api/reports/student?format=docx", json=STUDENT_BODY).status_code == 422


def test_reports_require_internal_token_when_configured(monkeypatch):
    monkeypatch.setattr(config, "INTERNAL_API_TOKEN", "secret-123")
    assert client.post("/api/reports/class", json=CLASS_BODY).status_code == 401
    ok = client.post("/api/reports/class", json=CLASS_BODY, headers={"X-Internal-Token": "secret-123"})
    assert ok.status_code == 200
