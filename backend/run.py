"""
SHADOWTRACE - Application Entry Point
Reads PORT from environment (Render/Railway inject it automatically).
"""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    is_prod = os.environ.get("RENDER") or os.environ.get("RAILWAY_ENVIRONMENT")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_prod,       # no reload in production
        log_level="info",
    )
