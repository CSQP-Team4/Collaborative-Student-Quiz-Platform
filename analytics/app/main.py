"""CSQP analytics service (CSQP-6).

A small HTTP/JSON service that the Express API calls internally
(SAD 3.3: "Internal RPC"). It runs separately so heavy statistics and
report generation never block the Node event loop (SAD 3.5).

Run locally:   uvicorn app.main:app --reload --port 8001
API docs:      http://localhost:8001/docs
"""

from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse, Response

from app import __version__, config, mock_data, reports
from app.class_analytics import ClassSummaryRequest, build_class_summary
from app.student_performance import StudentSummaryRequest, build_student_summary

ReportFormat = Literal["pdf", "csv"]
MEDIA_TYPES = {"pdf": "application/pdf", "csv": "text/csv; charset=utf-8"}


class StudentReportRequest(StudentSummaryRequest):
    studentName: str = "Student"


class ClassReportRequest(ClassSummaryRequest):
    instructorName: str = "Instructor"


def _file(content: bytes, fmt: str, basename: str) -> Response:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=content,
        media_type=MEDIA_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="{basename}-{stamp}.{fmt}"'},
    )

app = FastAPI(
    title="CSQP Analytics Service",
    version=__version__,
    description="Internal analytics worker for the Collaborative Study Material & Quiz Platform.",
)


def check_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    """Reject /api/* calls without the shared token, when one is configured."""
    if config.INTERNAL_API_TOKEN and x_internal_token != config.INTERNAL_API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Internal-Token")


def _dependency_versions() -> dict:
    """Confirm the analytics libraries from SAD 3.6 are installed and importable."""
    import pandas
    import reportlab

    return {"pandas": pandas.__version__, "reportlab": reportlab.Version}


@app.get("/health")
def health() -> dict:
    """Liveness check used by the Express API and uptime monitoring (SAD 4.4)."""
    return {
        "status": "ok",
        "service": config.SERVICE_NAME,
        "version": __version__,
        "dependencies": _dependency_versions(),
    }


@app.get("/api/ping", dependencies=[Depends(check_internal_token)])
def ping() -> dict:
    """Round-trip check that the Express API can reach this service."""
    return {"message": "pong", "service": config.SERVICE_NAME}


# ---- Real analytics endpoints ----

@app.post("/api/students/summary", dependencies=[Depends(check_internal_token)])
def student_summary(body: StudentSummaryRequest) -> dict:
    """CSQP-F-040: quiz history, score trend and topic strengths for one student."""
    return build_student_summary(body)


@app.post("/api/quizzes/class-summary", dependencies=[Depends(check_internal_token)])
def class_summary(body: ClassSummaryRequest) -> dict:
    """CSQP-F-041: average score, participation and most-missed questions per quiz."""
    return build_class_summary(body)


# ---- Report exports (CSQP-F-043): same summaries as the dashboards ----

@app.post("/api/reports/student", dependencies=[Depends(check_internal_token)])
def student_report(body: StudentReportRequest, format: ReportFormat = Query("pdf")) -> Response:
    summary = build_student_summary(body)
    if format == "csv":
        return _file(reports.student_report_csv(summary, body.studentName), format, "csqp-my-progress")
    return _file(reports.student_report_pdf(summary, body.studentName), format, "csqp-my-progress")


@app.post("/api/reports/class", dependencies=[Depends(check_internal_token)])
def class_report(body: ClassReportRequest, format: ReportFormat = Query("pdf")) -> Response:
    summary = build_class_summary(body)
    if format == "csv":
        return _file(reports.class_report_csv(summary), format, "csqp-class-analytics")
    return _file(reports.class_report_pdf(summary, body.instructorName), format, "csqp-class-analytics")


# ---- Mock endpoints (STP 10: mock analytics during API functional testing) ----

@app.get("/api/mock/students/{student_id}/summary", dependencies=[Depends(check_internal_token)])
def mock_student_summary(student_id: str) -> dict:
    return mock_data.student_summary(student_id)


@app.get("/api/mock/quizzes/{quiz_id}/class-summary", dependencies=[Depends(check_internal_token)])
def mock_class_summary(quiz_id: str) -> dict:
    return mock_data.class_summary(quiz_id)


@app.exception_handler(HTTPException)
def http_error(_request, exc: HTTPException) -> JSONResponse:
    """Same error envelope as the Express API (SAD 4.4)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "statusCode": exc.status_code,
            "error": "UNAUTHORIZED" if exc.status_code == 401 else "HTTP_ERROR",
            "message": exc.detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=config.PORT, reload=True)
