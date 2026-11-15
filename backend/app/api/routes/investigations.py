"""
SHADOWTRACE - Investigations Routes
Full CRUD for investigations with file evidence upload.
"""
import hashlib
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_active_user
from app.db.database import get_db
from app.models.models import Evidence, Investigation, User
from app.schemas.schemas import (
    EvidenceOut,
    InvestigationCreate,
    InvestigationOut,
    InvestigationUpdate,
    PaginatedResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/investigations", tags=["Investigations"])

ALLOWED_EXTENSIONS = {
    "txt", "log", "csv", "json", "pcap", "pcapng",
    "pdf", "png", "jpg", "jpeg", "zip", "gz",
}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def _get_investigation_or_404(
    investigation_id: str, user_id: str, db: Session
) -> Investigation:
    inv = (
        db.query(Investigation)
        .filter(Investigation.id == investigation_id, Investigation.user_id == user_id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found.")
    return inv


def _build_investigation_out(inv: Investigation, db: Session) -> InvestigationOut:
    evidence_count = db.query(func.count(Evidence.id)).filter(
        Evidence.investigation_id == inv.id
    ).scalar() or 0
    out = InvestigationOut.model_validate(inv)
    out.evidence_count = evidence_count
    return out


@router.post("", response_model=InvestigationOut, status_code=status.HTTP_201_CREATED)
def create_investigation(
    inv_in: InvestigationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> InvestigationOut:
    """Create a new investigation for the current user."""
    inv = Investigation(
        user_id=current_user.id,
        title=inv_in.title,
        description=inv_in.description,
        status=inv_in.status,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    logger.info("Investigation created: %s by user %s", inv.id, current_user.id)
    return _build_investigation_out(inv, db)


@router.get("", response_model=PaginatedResponse[InvestigationOut])
def list_investigations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> PaginatedResponse[InvestigationOut]:
    """List investigations for the current user (paginated)."""
    query = db.query(Investigation).filter(Investigation.user_id == current_user.id)
    if status_filter:
        query = query.filter(Investigation.status == status_filter)

    total = query.count()
    investigations = (
        query.order_by(Investigation.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [_build_investigation_out(inv, db) for inv in investigations]
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
    )


@router.get("/{investigation_id}", response_model=InvestigationOut)
def get_investigation(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> InvestigationOut:
    """Get a single investigation by ID."""
    inv = _get_investigation_or_404(investigation_id, current_user.id, db)
    return _build_investigation_out(inv, db)


@router.put("/{investigation_id}", response_model=InvestigationOut)
def update_investigation(
    investigation_id: str,
    inv_update: InvestigationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> InvestigationOut:
    """Update an investigation's title, description, or status."""
    inv = _get_investigation_or_404(investigation_id, current_user.id, db)
    if inv_update.title is not None:
        inv.title = inv_update.title
    if inv_update.description is not None:
        inv.description = inv_update.description
    if inv_update.status is not None:
        inv.status = inv_update.status
    db.commit()
    db.refresh(inv)
    return _build_investigation_out(inv, db)


@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investigation(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete an investigation and all associated data."""
    inv = _get_investigation_or_404(investigation_id, current_user.id, db)
    db.delete(inv)
    db.commit()
    logger.info("Investigation deleted: %s", investigation_id)


# ---------------------------------------------------------------------------
# Evidence endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{investigation_id}/evidence",
    response_model=EvidenceOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_evidence(
    investigation_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> EvidenceOut:
    """Upload a file as evidence for an investigation."""
    _get_investigation_or_404(investigation_id, current_user.id, db)

    # Validate extension
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type .{ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 100 MB limit.",
        )

    # Compute hash
    sha256 = hashlib.sha256(content).hexdigest()

    # Save to disk
    upload_dir = os.path.join(settings.UPLOAD_DIR, investigation_id)
    os.makedirs(upload_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(upload_dir, unique_name)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Persist record
    evidence = Evidence(
        investigation_id=investigation_id,
        user_id=current_user.id,
        filename=unique_name,
        original_filename=file.filename or unique_name,
        file_type=file.content_type or f"application/{ext}",
        file_size=len(content),
        file_path=file_path,
        sha256_hash=sha256,
        processing_status="pending",
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    logger.info(
        "Evidence uploaded: %s (sha256=%s) for investigation %s",
        evidence.id, sha256, investigation_id,
    )
    return EvidenceOut.model_validate(evidence)


@router.get("/{investigation_id}/evidence", response_model=List[EvidenceOut])
def list_evidence(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[EvidenceOut]:
    """List all evidence for an investigation."""
    _get_investigation_or_404(investigation_id, current_user.id, db)
    items = (
        db.query(Evidence)
        .filter(Evidence.investigation_id == investigation_id)
        .order_by(Evidence.created_at.desc())
        .all()
    )
    return [EvidenceOut.model_validate(e) for e in items]


@router.delete(
    "/{investigation_id}/evidence/{evidence_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_evidence(
    investigation_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    """Delete a specific evidence file from an investigation."""
    _get_investigation_or_404(investigation_id, current_user.id, db)
    ev = (
        db.query(Evidence)
        .filter(Evidence.id == evidence_id, Evidence.investigation_id == investigation_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence not found.")
    # Remove file from disk
    if os.path.exists(ev.file_path):
        try:
            os.remove(ev.file_path)
        except OSError as exc:
            logger.warning("Could not delete file %s: %s", ev.file_path, exc)
    db.delete(ev)
    db.commit()
