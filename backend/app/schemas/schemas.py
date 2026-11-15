"""
SHADOWTRACE - Pydantic v2 Schemas
Request/response models for all API endpoints.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic pagination
# ---------------------------------------------------------------------------

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("full_name must not be blank")
        return v.strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    password: Optional[str] = Field(None, min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Auth / Token schemas
# ---------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Investigation schemas
# ---------------------------------------------------------------------------

class InvestigationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=5000)
    status: str = Field("open", pattern="^(open|closed|archived)$")


class InvestigationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=5000)
    status: Optional[str] = Field(None, pattern="^(open|closed|archived)$")


class InvestigationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: str
    title: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    evidence_count: Optional[int] = 0


# ---------------------------------------------------------------------------
# Evidence schemas
# ---------------------------------------------------------------------------

class EvidenceOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    investigation_id: str
    user_id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    sha256_hash: str
    processing_status: str
    processing_result: Optional[Any] = None
    created_at: datetime

    @field_validator("processing_result", mode="before")
    @classmethod
    def parse_json_result(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return v
        return v


# ---------------------------------------------------------------------------
# Scan schemas
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=2000)
    investigation_id: Optional[str] = None


class ScanResultOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: str
    investigation_id: Optional[str]
    scan_type: str
    target: str
    risk_score: float
    risk_level: str
    findings: Optional[Any] = None
    raw_results: Optional[Any] = None
    created_at: datetime

    @field_validator("findings", "raw_results", mode="before")
    @classmethod
    def parse_json_fields(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return v
        return v


# ---------------------------------------------------------------------------
# Chat / AI schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    investigation_id: str


class ChatMessageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: str
    investigation_id: str
    role: str
    content: str
    sources: Optional[Any] = None
    created_at: datetime

    @field_validator("sources", mode="before")
    @classmethod
    def parse_sources(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return v
        return v


# ---------------------------------------------------------------------------
# Report schemas
# ---------------------------------------------------------------------------

class ReportOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: str
    investigation_id: str
    title: str
    executive_summary: Optional[str]
    evidence_overview: Optional[str]
    threat_findings: Optional[str]
    incident_timeline: Optional[Any] = None
    mitre_mappings: Optional[Any] = None
    risk_assessment: Optional[str]
    recommendations: Optional[str]
    pdf_path: Optional[str]
    created_at: datetime

    @field_validator("incident_timeline", "mitre_mappings", mode="before")
    @classmethod
    def parse_json_fields(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return v
        return v


# ---------------------------------------------------------------------------
# Timeline schemas
# ---------------------------------------------------------------------------

class TimelineEventOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    investigation_id: str
    timestamp: datetime
    event_type: str
    severity: str
    title: str
    description: Optional[str]
    source_evidence: Optional[Any] = None
    is_inferred: bool
    created_at: datetime

    @field_validator("source_evidence", mode="before")
    @classmethod
    def parse_source_evidence(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, ValueError):
                return v
        return v


# ---------------------------------------------------------------------------
# Dashboard schemas
# ---------------------------------------------------------------------------

class ThreatDistribution(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    safe: int = 0


class DashboardStats(BaseModel):
    total_investigations: int
    critical_threats: int
    suspicious_indicators: int
    evidence_count: int
    threat_distribution: ThreatDistribution
    recent_investigations: List[InvestigationOut]


# ---------------------------------------------------------------------------
# Network analysis schemas
# ---------------------------------------------------------------------------

class NetworkAnalysisResult(BaseModel):
    total_flows: int
    benign_count: int
    attack_count: int
    attack_types: Dict[str, int]
    anomaly_score: float
    top_suspicious_ips: List[Dict[str, Any]]
    attack_timeline: List[Dict[str, Any]]
    feature_importance: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Log analysis schemas
# ---------------------------------------------------------------------------

class LogAnalysisResult(BaseModel):
    total_lines: int
    parsed_events: int
    unique_ips: List[str]
    unique_users: List[str]
    findings: List[Dict[str, Any]]
    severity_summary: Dict[str, int]
    patterns_detected: List[str]


# ---------------------------------------------------------------------------
# Threat intel schemas
# ---------------------------------------------------------------------------

class MITRETechnique(BaseModel):
    id: str
    name: str
    tactic: str
    description: str
    url: str


class ThreatIntelResult(BaseModel):
    query: str
    results: List[Dict[str, Any]]
    total: int
