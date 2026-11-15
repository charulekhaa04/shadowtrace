"""
SHADOWTRACE - Additional API Routes: Dashboard, Reports, Threat Intel, AI
"""
# dashboard.py content below:

DASHBOARD_CONTENT = """\"""
SHADOWTRACE - Dashboard Route
Returns aggregated statistics for the current user.
\"""
import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user
from app.db.database import get_db
from app.models.models import Evidence, Investigation, ScanResult, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    uid = current_user.id

    total_investigations = db.query(Investigation).filter(Investigation.user_id == uid).count()
    open_investigations = db.query(Investigation).filter(
        Investigation.user_id == uid, Investigation.status == "open"
    ).count()

    scan_results = db.query(ScanResult).filter(ScanResult.user_id == uid).all()
    critical_threats = sum(1 for s in scan_results if s.risk_level == "critical")
    suspicious_indicators = sum(1 for s in scan_results if s.risk_level in ("critical", "high", "medium"))

    evidence_count = db.query(Evidence).filter(Evidence.user_id == uid).count()

    # Threat distribution by scan type
    threat_dist: Dict[str, int] = {}
    for s in scan_results:
        threat_dist[s.scan_type] = threat_dist.get(s.scan_type, 0) + 1

    # Recent investigations
    recent = (
        db.query(Investigation)
        .filter(Investigation.user_id == uid)
        .order_by(Investigation.created_at.desc())
        .limit(5)
        .all()
    )
    recent_investigations = [
        {
            "id": inv.id,
            "title": inv.title,
            "status": inv.status,
            "created_at": inv.created_at.isoformat(),
            "evidence_count": db.query(Evidence).filter(Evidence.investigation_id == inv.id).count(),
        }
        for inv in recent
    ]

    # Recent scans
    recent_scans = (
        db.query(ScanResult)
        .filter(ScanResult.user_id == uid)
        .order_by(ScanResult.created_at.desc())
        .limit(10)
        .all()
    )
    recent_scan_list = [
        {
            "id": s.id,
            "scan_type": s.scan_type,
            "target": s.target[:80],
            "risk_level": s.risk_level,
            "risk_score": s.risk_score,
            "created_at": s.created_at.isoformat(),
        }
        for s in recent_scans
    ]

    return {
        "total_investigations": total_investigations,
        "open_investigations": open_investigations,
        "critical_threats": critical_threats,
        "suspicious_indicators": suspicious_indicators,
        "evidence_count": evidence_count,
        "threat_distribution": threat_dist,
        "recent_investigations": recent_investigations,
        "recent_scans": recent_scan_list,
    }
"""
