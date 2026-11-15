"""
SHADOWTRACE - Model Training & RAG Indexing Script
Run this once to train ML models on CIC-IDS2017 and index the SMAH-CTI dataset.
"""
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main():
    # Load settings
    from app.core.config import settings

    logger.info("=" * 60)
    logger.info("SHADOWTRACE — Model Training & RAG Indexing")
    logger.info("=" * 60)

    # 1. Train ML models
    logger.info("\n[1/2] Training ML models on CIC-IDS2017...")
    try:
        from app.ml.train import train_models
        meta = train_models(settings.CIC_IDS_PATH, settings.MODEL_DIR)
        logger.info("Training complete. RF accuracy: %.4f", meta.get("rf_accuracy", 0))
    except FileNotFoundError as e:
        logger.error("Dataset not found: %s", e)
        logger.error("Please ensure CIC_IDS_PATH in .env points to the CIC-IDS2017 directory.")
    except Exception as e:
        logger.error("Training failed: %s", e)
        import traceback; traceback.print_exc()

    # 2. Index SMAH-CTI into ChromaDB
    logger.info("\n[2/2] Indexing SMAH-CTI dataset into ChromaDB...")
    try:
        from app.services.rag_service import RAGService
        rag = RAGService(
            chroma_dir=settings.CHROMA_DIR,
            smah_cti_path=settings.SMAH_CTI_PATH,
        )
        rag.index_cti()
        logger.info("CTI indexing complete.")
    except Exception as e:
        logger.error("RAG indexing failed: %s", e)
        import traceback; traceback.print_exc()

    logger.info("\n" + "=" * 60)
    logger.info("Done! Start the backend with: python run.py")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
