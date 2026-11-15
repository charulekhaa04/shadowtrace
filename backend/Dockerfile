FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Try to install RAG packages (optional, graceful fallback if they fail)
COPY requirements-rag.txt .
RUN pip install --no-cache-dir -r requirements-rag.txt || echo "RAG packages not installed — running without RAG"

# Copy app
COPY . .

# Create data directories
RUN mkdir -p data/models data/uploads data/chromadb

# Initialise database tables
RUN python -c "from app.db.database import engine; from app.models.models import Base; Base.metadata.create_all(engine); print('DB tables created')"

EXPOSE 8000

CMD ["python", "run.py"]
