"""
SHADOWTRACE - AI Chat & Timeline Route
RAG-powered investigation assistant and timeline generation.
"""
import json
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_active_user
from app.db.database import get_db
from app.models.models import ChatMessage, Evidence, Investigation, ScanResult, TimelineEvent, User
from app.schemas.schemas import ChatRequest
from app.services.rag_service import RAGService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Assistant"])

_rag = RAGService(
    chroma_dir=settings.CHROMA_DIR,
    smah_cti_path=settings.SMAH_CTI_PATH,
    ollama_base_url=settings.OLLAMA_BASE_URL,
    ollama_model=settings.OLLAMA_MODEL,
)


@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """AI investigation assistant with RAG."""
    investigation_id = request.investigation_id

    # Verify investigation ownership
    inv = db.query(Investigation).filter(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    # Save user message
    user_msg = ChatMessage(
        user_id=current_user.id,
        investigation_id=investigation_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)
    db.commit()

    # Build investigation context summary
    scan_results = db.query(ScanResult).filter(
        ScanResult.investigation_id == investigation_id
    ).all()
    evidence_items = db.query(Evidence).filter(
        Evidence.investigation_id == investigation_id
    ).all()

    context_parts = [f"Investigation: {inv.title}"]
    if scan_results:
        context_parts.append(f"Scans performed: {len(scan_results)}")
        for s in scan_results[:5]:
            context_parts.append(
                f"  - {s.scan_type.upper()} scan of '{s.target[:50]}': "
                f"Risk {s.risk_level.upper()} ({s.risk_score}/100)"
            )
    if evidence_items:
        context_parts.append(f"Evidence files: {len(evidence_items)}")

    investigation_context = "\n".join(context_parts)

    # Retrieve from CTI + evidence
    cti_chunks = _rag.query_cti(request.message, n_results=4)
    evidence_chunks = _rag.query_evidence(request.message, investigation_id, n_results=3)
    all_chunks = cti_chunks + evidence_chunks

    # Generate response
    result = await _rag.generate_response(
        question=request.message,
        context_chunks=all_chunks,
        investigation_context=investigation_context,
    )

    # Save assistant message
    assistant_msg = ChatMessage(
        user_id=current_user.id,
        investigation_id=investigation_id,
        role="assistant",
        content=result["response"],
        sources=json.dumps(result.get("sources", [])),
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return {
        "id": assistant_msg.id,
        "role": "assistant",
        "content": result["response"],
        "sources": result.get("sources", []),
        "confidence": result.get("confidence", 0.5),
        "model": result.get("model", "unknown"),
        "grounded": result.get("grounded", False),
        "created_at": assistant_msg.created_at.isoformat(),
    }


@router.get("/chat/{investigation_id}/history")
def get_chat_history(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[Dict[str, Any]]:
    """Get chat history for an investigation."""
    inv = db.query(Investigation).filter(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.investigation_id == investigation_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": json.loads(m.sources) if m.sources else [],
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.get("/timeline/{investigation_id}")
def get_timeline(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> List[Dict[str, Any]]:
    """Get timeline events for an investigation."""
    inv = db.query(Investigation).filter(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    # Auto-generate timeline from scan results if none exist
    existing = db.query(TimelineEvent).filter(
        TimelineEvent.investigation_id == investigation_id
    ).all()

    if not existing:
        _auto_generate_timeline(investigation_id, db)
        existing = db.query(TimelineEvent).filter(
            TimelineEvent.investigation_id == investigation_id
        ).all()

    return [
        {
            "id": e.id,
            "timestamp": e.timestamp.isoformat(),
            "event_type": e.event_type,
            "severity": e.severity,
            "title": e.title,
            "description": e.description,
            "is_inferred": e.is_inferred,
            "source_evidence": json.loads(e.source_evidence) if e.source_evidence else [],
        }
        for e in sorted(existing, key=lambda x: x.timestamp)
    ]


def _auto_generate_timeline(investigation_id: str, db: Session):
    """Auto-generate timeline events from scan results."""
    scans = db.query(ScanResult).filter(
        ScanResult.investigation_id == investigation_id
    ).order_by(ScanResult.created_at.asc()).all()

    for scan in scans:
        severity_map = {"critical": "critical", "high": "high", "medium": "medium", "low": "low", "safe": "info"}
        severity = severity_map.get(scan.risk_level, "info")

        if scan.risk_level in ("critical", "high", "medium"):
            event = TimelineEvent(
                investigation_id=investigation_id,
                timestamp=scan.created_at,
                event_type=f"{scan.scan_type}_scan",
                severity=severity,
                title=f"{scan.scan_type.upper()} Threat Detected: {scan.target[:60]}",
                description=(
                    f"Scan of '{scan.target}' returned risk score {scan.risk_score}/100 "
                    f"({scan.risk_level.upper()})."
                ),
                is_inferred=False,
                source_evidence=json.dumps([scan.id]),
            )
            db.add(event)

    db.commit()


@router.get("/correlation/{investigation_id}")
def get_correlation_graph(
    investigation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Build entity correlation graph from investigation data."""
    inv = db.query(Investigation).filter(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found.")

    scans = db.query(ScanResult).filter(
        ScanResult.investigation_id == investigation_id
    ).all()

    nodes = []
    edges = []
    seen_nodes = set()

    # Investigation node
    inv_node_id = f"inv_{investigation_id[:8]}"
    nodes.append({
        "id": inv_node_id, "type": "investigation",
        "label": inv.title[:30], "risk_level": "info",
    })
    seen_nodes.add(inv_node_id)

    for scan in scans:
        node_id = f"{scan.scan_type}_{scan.id[:8]}"
        risk = scan.risk_level
        if node_id not in seen_nodes:
            nodes.append({
                "id": node_id,
                "type": scan.scan_type,
                "label": scan.target[:50],
                "risk_level": risk,
                "risk_score": scan.risk_score,
            })
            seen_nodes.add(node_id)

        edges.append({
            "id": f"edge_{inv_node_id}_{node_id}",
            "source": inv_node_id,
            "target": node_id,
            "relationship": "contains",
        })

        # Cross-link same-type targets
        findings_raw = scan.findings or "[]"
        try:
            findings = json.loads(findings_raw)
        except Exception:
            findings = []

        for f in findings:
            indicator = f.get("indicator", "")
            if indicator and indicator not in seen_nodes:
                ind_node_id = f"ioc_{hash(indicator) % 100000}"
                nodes.append({
                    "id": ind_node_id,
                    "type": "indicator",
                    "label": indicator[:50],
                    "risk_level": f.get("severity", "medium"),
                })
                seen_nodes.add(ind_node_id)
                edges.append({
                    "id": f"edge_{node_id}_{ind_node_id}",
                    "source": node_id,
                    "target": ind_node_id,
                    "relationship": f.get("type", "related"),
                })

    return {"nodes": nodes, "edges": edges, "investigation_id": investigation_id}
