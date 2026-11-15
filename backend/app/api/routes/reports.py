"""
SHADOWTRACE - Reports Route
Generate and download forensic reports.
"""
import json
import logging
import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user
from app.core.config import settings
from app.db.database import get_db
from app.models.models import Evidence, ForensicReport, Investigation, ScanResult, TimelineEvent, User
from app.services.report_generator import ReportGeneratorService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Reports"])

_report_svc = ReportGeneratorService(upload_dir=settings.UPLOAD_DIR)


@router.post("/generate/{investigation_id}")
async def generate_report(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Generate a forensic report for an investigation."""
    inv = db.query(Investigation).filter(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    evidence = db.query(Evidence).filter(Evidence.investigation_id == investigation_id).all()
    scans = db.query(ScanResult).filter(ScanResult.investigation_id == investigation_id).all()
    timeline = db.query(TimelineEvent).filter(TimelineEvent.investigation_id == investigation_id).all()

    inv_dict = {"id": inv.id, "title": inv.title, "created_at": inv.created_at}
    evidence_dicts = [
        {"id": e.id, "filename": e.filename, "original_filename": e.original_filename,
         "file_type": e.file_type, "file_size": e.file_size, "sha256_hash": e.sha256_hash,
         "created_at": e.created_at}
        for e in evidence
    ]
    scan_dicts = [
        {"id": s.id, "scan_type": s.scan_type, "target": s.target,
         "risk_level": s.risk_level, "risk_score": s.risk_score,
         "findings": json.loads(s.findings) if s.findings else [],
         "created_at": s.created_at}
        for s in scans
    ]
    timeline_dicts = [
        {"id": t.id, "timestamp": t.timestamp, "severity": t.severity,
         "title": t.title, "description": t.description, "is_inferred": t.is_inferred}
        for t in timeline
    ]

    report_data = _report_svc.generate_report_data(
        investigation=inv_dict,
        evidence_items=evidence_dicts,
        scan_results=scan_dicts,
        timeline_events=timeline_dicts,
        chat_messages=[],
    )

    # Generate PDF
    pdf_path = _report_svc.generate_pdf(report_data, investigation_id)

    # Save to DB
    existing = db.query(ForensicReport).filter(
        ForensicReport.investigation_id == investigation_id
    ).first()

    if existing:
        existing.title = f"Forensic Report — {inv.title}"
        existing.executive_summary = report_data.get("executive_summary", "")
        existing.evidence_overview = json.dumps(report_data.get("evidence_overview", {}))
        existing.threat_findings = json.dumps(report_data.get("threat_findings", []))
        existing.incident_timeline = json.dumps(report_data.get("incident_timeline", []))
        existing.mitre_mappings = json.dumps(report_data.get("mitre_mappings", []))
        existing.risk_assessment = json.dumps(report_data.get("risk_assessment", {}))
        existing.recommendations = json.dumps(report_data.get("recommendations", []))
        existing.pdf_path = pdf_path
        db.commit()
        db.refresh(existing)
        db_report = existing
    else:
        db_report = ForensicReport(
            user_id=current_user.id,
            investigation_id=investigation_id,
            title=f"Forensic Report — {inv.title}",
            executive_summary=report_data.get("executive_summary", ""),
            evidence_overview=json.dumps(report_data.get("evidence_overview", {})),
            threat_findings=json.dumps(report_data.get("threat_findings", [])),
            incident_timeline=json.dumps(report_data.get("incident_timeline", [])),
            mitre_mappings=json.dumps(report_data.get("mitre_mappings", [])),
            risk_assessment=json.dumps(report_data.get("risk_assessment", {})),
            recommendations=json.dumps(report_data.get("recommendations", [])),
            pdf_path=pdf_path,
        )
        db.add(db_report)
        db.commit()
        db.refresh(db_report)

    return {
        "id": db_report.id,
        "investigation_id": investigation_id,
        "title": db_report.title,
        "overall_risk": report_data.get("overall_risk"),
        "pdf_available": pdf_path is not None,
        "created_at": db_report.created_at.isoformat(),
        "data": report_data,
    }


@router.get("/{investigation_id}")
def get_report(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Get the existing report for an investigation."""
    report = db.query(ForensicReport).filter(
        ForensicReport.investigation_id == investigation_id,
        ForensicReport.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="No report found. Generate one first.")

    return {
        "id": report.id,
        "investigation_id": investigation_id,
        "title": report.title,
        "executive_summary": report.executive_summary,
        "evidence_overview": json.loads(report.evidence_overview or "{}"),
        "threat_findings": json.loads(report.threat_findings or "[]"),
        "incident_timeline": json.loads(report.incident_timeline or "[]"),
        "mitre_mappings": json.loads(report.mitre_mappings or "[]"),
        "risk_assessment": json.loads(report.risk_assessment or "{}"),
        "recommendations": json.loads(report.recommendations or "[]"),
        "pdf_available": report.pdf_path is not None and os.path.exists(report.pdf_path or ""),
        "created_at": report.created_at.isoformat(),
    }


@router.get("/{investigation_id}/pdf")
def download_pdf(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Download the PDF report."""
    report = db.query(ForensicReport).filter(
        ForensicReport.investigation_id == investigation_id,
        ForensicReport.user_id == current_user.id,
    ).first()
    if not report or not report.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not available.")
    if not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server.")

    return FileResponse(
        report.pdf_path,
        media_type="application/pdf",
        filename=f"shadowtrace_report_{investigation_id[:8]}.pdf",
    )
