"""
SHADOWTRACE - RAG Service
ChromaDB-backed retrieval for CTI knowledge and investigation evidence.
"""
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

COLLECTION_CTI = "shadowtrace_cti"
COLLECTION_EVIDENCE = "shadowtrace_evidence"


class RAGService:
    def __init__(self, chroma_dir: str, smah_cti_path: str,
                 ollama_base_url: str = "http://localhost:11434",
                 ollama_model: str = "qwen2.5:7b"):
        self.chroma_dir = chroma_dir
        self.smah_cti_path = smah_cti_path
        self.ollama_base_url = ollama_base_url
        self.ollama_model = ollama_model
        self._client = None
        self._cti_collection = None
        self._evidence_collection = None
        self._embedding_fn = None

    def _init(self):
        if self._client is not None:
            return
        try:
            import chromadb
            from chromadb.config import Settings
            from sentence_transformers import SentenceTransformer

            os.makedirs(self.chroma_dir, exist_ok=True)
            self._client = chromadb.PersistentClient(path=self.chroma_dir)

            model = SentenceTransformer("all-MiniLM-L6-v2")

            class EmbeddingFunction:
                def __call__(self, input: List[str]) -> List[List[float]]:
                    return model.encode(input, convert_to_numpy=True).tolist()

            self._embedding_fn = EmbeddingFunction()
            self._cti_collection = self._client.get_or_create_collection(
                name=COLLECTION_CTI,
                embedding_function=self._embedding_fn,
            )
            self._evidence_collection = self._client.get_or_create_collection(
                name=COLLECTION_EVIDENCE,
                embedding_function=self._embedding_fn,
            )
            logger.info("RAG service initialised with ChromaDB")
        except Exception as e:
            logger.error("RAG init failed: %s", e)
            self._client = None

    def index_cti(self):
        """Index SMAH-CTI dataset into ChromaDB."""
        self._init()
        if self._client is None or self._cti_collection is None:
            logger.warning("Cannot index CTI — ChromaDB not available")
            return

        try:
            existing = self._cti_collection.count()
            if existing > 100:
                logger.info("CTI collection already has %d documents, skipping re-index", existing)
                return
        except Exception:
            pass

        try:
            path = Path(self.smah_cti_path)
            if not path.exists():
                logger.warning("SMAH-CTI file not found: %s", self.smah_cti_path)
                return

            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Filter to relevant entries with at least some content
            relevant = [
                item for item in data
                if item.get("sentence_text") and len(item["sentence_text"].strip()) > 20
                and (item.get("relevant") == "yes" or item.get("entities") or item.get("techniques"))
            ]

            if not relevant:
                # Fall back to all entries
                relevant = [item for item in data if item.get("sentence_text", "").strip()]

            # Batch index (ChromaDB has limits)
            batch_size = 100
            indexed = 0
            for i in range(0, min(len(relevant), 5000), batch_size):
                batch = relevant[i:i + batch_size]
                documents = [item["sentence_text"].strip() for item in batch]
                ids = [item.get("uid", f"cti-{i+j}") for j, item in enumerate(batch)]
                metadatas = [{
                    "source": item.get("source", ""),
                    "doc_id": item.get("doc_id", ""),
                    "tactic": json.dumps(item.get("tactic")) if item.get("tactic") else "",
                    "techniques": json.dumps(item.get("techniques")) if item.get("techniques") else "",
                    "entities": json.dumps(item.get("entities")) if item.get("entities") else "",
                } for item in batch]

                self._cti_collection.upsert(
                    documents=documents,
                    ids=ids,
                    metadatas=metadatas,
                )
                indexed += len(batch)

            logger.info("Indexed %d CTI documents", indexed)
        except Exception as e:
            logger.error("CTI indexing failed: %s", e)

    def index_evidence(self, investigation_id: str, evidence_id: str, text: str, metadata: Dict = None):
        """Add evidence text to the investigation's evidence collection."""
        self._init()
        if self._evidence_collection is None:
            return
        try:
            self._evidence_collection.upsert(
                documents=[text[:5000]],
                ids=[f"{investigation_id}_{evidence_id}"],
                metadatas=[{"investigation_id": investigation_id,
                            "evidence_id": evidence_id,
                            **(metadata or {})}],
            )
        except Exception as e:
            logger.error("Evidence indexing failed: %s", e)

    def query_cti(self, question: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Retrieve relevant CTI passages for a question."""
        self._init()
        if self._cti_collection is None:
            return []
        try:
            results = self._cti_collection.query(
                query_texts=[question],
                n_results=min(n_results, self._cti_collection.count() or 1),
            )
            chunks = []
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                chunks.append({
                    "text": doc,
                    "source": meta.get("source", "CTI"),
                    "tactic": meta.get("tactic", ""),
                    "techniques": meta.get("techniques", ""),
                    "relevance": round(1 - dist, 3),
                })
            return chunks
        except Exception as e:
            logger.error("CTI query failed: %s", e)
            return []

    def query_evidence(self, question: str, investigation_id: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """Retrieve relevant evidence passages for an investigation."""
        self._init()
        if self._evidence_collection is None:
            return []
        try:
            count = self._evidence_collection.count()
            if count == 0:
                return []
            results = self._evidence_collection.query(
                query_texts=[question],
                n_results=min(n_results, count),
                where={"investigation_id": investigation_id},
            )
            chunks = []
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                chunks.append({
                    "text": doc,
                    "source": f"Evidence: {meta.get('evidence_id', 'unknown')}",
                    "relevance": round(1 - dist, 3),
                })
            return chunks
        except Exception as e:
            logger.debug("Evidence query failed (may be empty): %s", e)
            return []

    async def generate_response(self, question: str, context_chunks: List[Dict],
                                 investigation_context: str = "") -> Dict[str, Any]:
        """Generate LLM response grounded in retrieved context."""
        if not context_chunks:
            context_text = "No relevant context found in the knowledge base."
        else:
            context_text = "\n\n".join([
                f"[Source: {c['source']}]\n{c['text']}"
                for c in context_chunks
            ])

        system_prompt = """You are SHADOWTRACE, an AI-powered digital forensics and cyber incident investigation assistant.

IMPORTANT RULES:
1. Base your answers ONLY on the provided context and investigation data.
2. If you are not certain, say so explicitly — never present assumptions as confirmed facts.
3. When referencing evidence, cite the source.
4. Use clear, professional language appropriate for security analysts.
5. For threat analysis, reference MITRE ATT&CK techniques where applicable.
6. Never fabricate indicators of compromise (IOCs) or threat intelligence."""

        user_prompt = f"""Context from threat intelligence knowledge base and investigation evidence:

{context_text}

{f'Investigation context: {investigation_context}' if investigation_context else ''}

Question: {question}

Provide a detailed, evidence-grounded response. If citing specific findings, reference the source. 
Distinguish between confirmed findings and analytical inferences."""

        # Try Ollama first
        ollama_response = await self._call_ollama(system_prompt, user_prompt)
        if ollama_response:
            return {
                "response": ollama_response,
                "sources": [c["source"] for c in context_chunks],
                "confidence": self._estimate_confidence(context_chunks),
                "model": self.ollama_model,
                "grounded": True,
            }

        # Fallback: structured analytical response
        return self._fallback_response(question, context_chunks)

    async def _call_ollama(self, system: str, user: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(
                    f"{self.ollama_base_url}/api/chat",
                    json={
                        "model": self.ollama_model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "stream": False,
                    },
                )
                if r.status_code == 200:
                    return r.json()["message"]["content"]
        except Exception as e:
            logger.debug("Ollama unavailable: %s", e)
        return None

    def _fallback_response(self, question: str, chunks: List[Dict]) -> Dict[str, Any]:
        """Structured response when LLM is unavailable."""
        if chunks:
            top_chunk = chunks[0]["text"]
            sources = [c["source"] for c in chunks]
            response = (
                f"Based on the available threat intelligence context:\n\n"
                f"{top_chunk}\n\n"
                f"**Note:** The AI language model is not currently available. "
                f"The above is retrieved directly from the knowledge base. "
                f"For full AI-generated analysis, ensure Ollama is running with the {self.ollama_model} model."
            )
        else:
            response = (
                "I couldn't find relevant context in the knowledge base for this query. "
                "Please ensure the SMAH-CTI dataset has been indexed and try rephrasing your question."
            )
            sources = []

        return {
            "response": response,
            "sources": sources,
            "confidence": 0.5 if chunks else 0.1,
            "model": "retrieval-only",
            "grounded": bool(chunks),
        }

    def _estimate_confidence(self, chunks: List[Dict]) -> float:
        if not chunks:
            return 0.1
        avg_relevance = sum(c.get("relevance", 0.5) for c in chunks) / len(chunks)
        return round(min(0.95, avg_relevance), 2)
