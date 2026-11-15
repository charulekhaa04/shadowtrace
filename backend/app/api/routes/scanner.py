"""
SHADOWTRACE - Scanner Routes
URL, email, and IP threat scanning endpoints.
"""
import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user
from app.db.database import get_db
from app.models.models import ScanResult, User
from app.schemas.schemas import PaginatedResponse, ScanRequest, ScanResultOut
from app.services.url_scanner import URLScannerService
from app.services.email_scanner import EmailScannerService
from app.services.ip_scanner import IPScannerService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scan", tags=["Scanner"])


def _persist_scan_result(
    db: Session,
    user_id: str,
    scan_type: str,
    target: str,
    result: Dict[str, Any],
    investigation_id: str | None,
) -> ScanResult:
    """Save a scan result to the database and return the ORM object."""
    record = ScanResult(
        user_id=user_id,
        investigation_id=investigation_id,
        scan_type=scan_type,
        target=target,
        risk_score=result.get("risk_score", 0.0),
        risk_level=result.get("risk_level", "safe"),
        findings=json.dumps(result.get("findings", [])),
        raw_results=json.dumps(result),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/url", response_model=ScanResultOut)
async def scan_url(
    request: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ScanResultOut:
    """Scan a URL for phishing, malware, and reputation threats."""
    service = URLScannerService()
    result = await service.scan(request.target)
    record = _persist_scan_result(
        db, current_user.id, "url", request.target, result, request.investigation_id
    )
    logger.info("URL scan: %s → risk=%s (%s)", request.target, result["risk_score"], result["risk_level"])
    return ScanResultOut.model_validate(record)


@router.post("/email", response_model=ScanResultOut)
async def scan_email(
    request: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ScanResultOut:
    """Scan an email address for spoofing, reputation, and phishing indicators."""
    service = EmailScannerService()
    result = await service.scan(request.target)
    record = _persist_scan_result(
        db, current_user.id, "email", request.target, result, request.investigation_id
    )
    logger.info("Email scan: %s → risk=%s (%s)", request.target, result["risk_score"], result["risk_level"])
    return ScanResultOut.model_validate(record)


@router.post("/ip", response_model=ScanResultOut)
async def scan_ip(
    request: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ScanResultOut:
    """Scan an IP address for geolocation, reputation, and abuse history."""
    service = IPScannerService()
    result = await service.scan(request.target)
    record = _persist_scan_result(
        db, current_user.id, "ip", request.target, result, request.investigation_id
    )
    logger.info("IP scan: %s → risk=%s (%s)", request.target, result["risk_score"], result["risk_level"])
    return ScanResultOut.model_validate(record)


@router.get("/history", response_model=PaginatedResponse[ScanResultOut])
def scan_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    scan_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PaginatedResponse[ScanResultOut]:
    """Paginated scan history for the current user."""
    query = db.query(ScanResult).filter(ScanResult.user_id == current_user.id)
    if scan_type:
        query = query.filter(ScanResult.scan_type == scan_type)

    total = query.count()
    items = (
        query.order_by(ScanResult.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=[ScanResultOut.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
