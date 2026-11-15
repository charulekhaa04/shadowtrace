"""
SHADOWTRACE - Analysis Routes
Network traffic ML analysis and log file analysis.
"""
import hashlib
import json
import logging
import os
import tempfile
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_active_user
from app.db.database import get_db
from app.models.models import Evidence, User
from app.services.network_ml import NetworkMLService
from app.services.log_analyzer import LogAnalyzerService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analysis", tags=["Analysis"])

_network_svc = NetworkMLService(model_dir=settings.MODEL_DIR)
_log_svc = LogAnalyzerService()


@router.post("/network-traffic")
async def analyse_network_traffic(
    file: UploadFile = File(...),
    investigation_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Accept a CSV of network flows and run ML-based attack detection."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only CSV files are accepted for network traffic analysis.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    # Save to temp file for pandas
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = await _network_svc.analyse(tmp_path, file.filename)
    finally:
        os.unlink(tmp_path)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    # Save evidence record if investigation_id provided
    if investigation_id:
        sha256 = hashlib.sha256(content).hexdigest()
        upload_path = os.path.join(settings.UPLOAD_DIR, f"net_{sha256[:16]}.csv")
        with open(upload_path, "wb") as f:
            f.write(content)
        evidence = Evidence(
            investigation_id=investigation_id,
            user_id=current_user.id,
            filename=f"net_{sha256[:16]}.csv",
            original_filename=file.filename,
            file_type="network_capture",
            file_size=len(content),
            file_path=upload_path,
            sha256_hash=sha256,
            processing_status="completed",
            processing_result=json.dumps({"type": "network_analysis", "summary": result}),
        )
        db.add(evidence)
        db.commit()
        result["evidence_id"] = evidence.id

    return result


@router.post("/logs")
async def analyse_logs(
    file: UploadFile = File(...),
    investigation_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Accept a log file (TXT/LOG/JSON/CSV) and extract security events."""
    allowed_extensions = (".txt", ".log", ".json", ".csv")
    fname = file.filename or ""
    if not any(fname.lower().endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type. Accepted: {', '.join(allowed_extensions)}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    file_type = fname.rsplit(".", 1)[-1].lower()

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_type}") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = await _log_svc.analyse(tmp_path, fname, file_type)
    finally:
        os.unlink(tmp_path)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    if investigation_id:
        sha256 = hashlib.sha256(content).hexdigest()
        upload_path = os.path.join(settings.UPLOAD_DIR, f"log_{sha256[:16]}.{file_type}")
        with open(upload_path, "wb") as f:
            f.write(content)
        evidence = Evidence(
            investigation_id=investigation_id,
            user_id=current_user.id,
            filename=f"log_{sha256[:16]}.{file_type}",
            original_filename=fname,
            file_type="log_file",
            file_size=len(content),
            file_path=upload_path,
            sha256_hash=sha256,
            processing_status="completed",
            processing_result=json.dumps({"type": "log_analysis", "summary": result}),
        )
        db.add(evidence)
        db.commit()
        result["evidence_id"] = evidence.id

    return result


@router.post("/multi-evidence")
async def analyse_multi_evidence(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Correlate all evidence in an investigation."""
    from app.models.models import Investigation, ScanResult

    inv = db.query(Investigation).filter(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    scans = db.query(ScanResult).filter(ScanResult.investigation_id == investigation_id).all()
    evidence = db.query(Evidence).filter(Evidence.investigation_id == investigation_id).all()

    # Count unique indicators
    all_ips, all_domains, all_emails, all_urls = set(), set(), set(), set()
    critical_count, high_count = 0, 0

    for scan in scans:
        if scan.risk_level == "critical":
            critical_count += 1
        elif scan.risk_level == "high":
            high_count += 1
        if scan.scan_type == "ip":
            all_ips.add(scan.target)
        elif scan.scan_type == "url":
            all_urls.add(scan.target)
        elif scan.scan_type == "email":
            all_emails.add(scan.target)

    return {
        "investigation_id": investigation_id,
        "total_scans": len(scans),
        "total_evidence": len(evidence),
        "critical_scans": critical_count,
        "high_risk_scans": high_count,
        "unique_ips": list(all_ips),
        "unique_urls": list(all_urls),
        "unique_emails": list(all_emails),
        "correlation_summary": (
            f"Analysed {len(scans)} scan results and {len(evidence)} evidence files. "
            f"Found {critical_count} critical and {high_count} high risk indicators."
        ),
    }
