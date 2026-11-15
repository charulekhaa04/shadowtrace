"""
SHADOWTRACE - FastAPI Main Application
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.database import engine, Base
from app.api.routes import (
    auth, investigations, scanner, analysis, ai, reports, dashboard, threat_intel
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting SHADOWTRACE backend...")
    # Create DB tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")

    # Create upload directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.MODEL_DIR, exist_ok=True)
    os.makedirs(settings.CHROMA_DIR, exist_ok=True)
    os.makedirs(os.path.join(settings.UPLOAD_DIR, "reports"), exist_ok=True)

    # Index CTI in background (non-blocking)
    try:
        from app.services.rag_service import RAGService
        rag = RAGService(
            chroma_dir=settings.CHROMA_DIR,
            smah_cti_path=settings.SMAH_CTI_PATH,
        )
        rag.index_cti()
        logger.info("CTI indexing complete")
    except Exception as e:
        logger.warning("CTI indexing failed (non-fatal): %s", e)

    logger.info("SHADOWTRACE backend ready on port 8000")
    yield
    logger.info("SHADOWTRACE shutting down")


app = FastAPI(
    title="SHADOWTRACE API",
    description="AI-Powered Digital Forensics & Cyber Incident Investigation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routers
PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(investigations.router, prefix=PREFIX)
app.include_router(scanner.router, prefix=PREFIX)
app.include_router(analysis.router, prefix=PREFIX)
app.include_router(ai.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(threat_intel.router, prefix=PREFIX)


@app.get("/health")
def health_check():
    return {"status": "ok", "app": "SHADOWTRACE", "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "app": "SHADOWTRACE",
        "tagline": "Every attack leaves traces. Let AI connect them.",
        "docs": "/docs",
    }
