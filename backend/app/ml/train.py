"""
SHADOWTRACE - ML Training Script
Trains RandomForest and XGBoost models on CIC-IDS2017 dataset.
"""
import json
import logging
import os
from pathlib import Path
from typing import List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FEATURE_COLS = [
    "Destination Port", "Flow Duration", "Total Fwd Packets", "Total Backward Packets",
    "Total Length of Fwd Packets", "Total Length of Bwd Packets",
    "Fwd Packet Length Max", "Fwd Packet Length Min", "Fwd Packet Length Mean",
    "Fwd Packet Length Std", "Bwd Packet Length Max", "Bwd Packet Length Min",
    "Bwd Packet Length Mean", "Bwd Packet Length Std",
    "Flow Bytes/s", "Flow Packets/s", "Flow IAT Mean", "Flow IAT Std",
    "Flow IAT Max", "Flow IAT Min", "Fwd IAT Total", "Fwd IAT Mean",
    "Fwd IAT Std", "Fwd IAT Max", "Fwd IAT Min", "Bwd IAT Total",
    "Bwd IAT Mean", "Bwd IAT Std", "Bwd IAT Max", "Bwd IAT Min",
    "Fwd PSH Flags", "Bwd PSH Flags", "Fwd URG Flags", "Bwd URG Flags",
    "Fwd Header Length", "Bwd Header Length", "Fwd Packets/s", "Bwd Packets/s",
    "Min Packet Length", "Max Packet Length", "Packet Length Mean",
    "Packet Length Std", "Packet Length Variance",
    "FIN Flag Count", "SYN Flag Count", "RST Flag Count", "PSH Flag Count",
    "ACK Flag Count", "URG Flag Count", "CWE Flag Count", "ECE Flag Count",
    "Down/Up Ratio", "Average Packet Size", "Avg Fwd Segment Size", "Avg Bwd Segment Size",
    "Subflow Fwd Packets", "Subflow Fwd Bytes", "Subflow Bwd Packets", "Subflow Bwd Bytes",
    "Init_Win_bytes_forward", "Init_Win_bytes_backward",
    "act_data_pkt_fwd", "min_seg_size_forward",
    "Active Mean", "Active Std", "Active Max", "Active Min",
    "Idle Mean", "Idle Std", "Idle Max", "Idle Min",
]


def load_cicids2017(data_dir: str, max_rows_per_file: int = 50000) -> pd.DataFrame:
    """Load all CSV files from CIC-IDS2017 directory."""
    data_path = Path(data_dir)
    csv_files = list(data_path.glob("*.csv"))

    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {data_dir}")

    logger.info("Found %d CSV files in %s", len(csv_files), data_dir)
    dfs = []

    for csv_file in csv_files:
        logger.info("Loading %s ...", csv_file.name)
        try:
            df = pd.read_csv(csv_file, nrows=max_rows_per_file, low_memory=False)
            df.columns = df.columns.str.strip()
            dfs.append(df)
        except Exception as e:
            logger.warning("Failed to load %s: %s", csv_file.name, e)

    if not dfs:
        raise ValueError("Could not load any CSV files")

    combined = pd.concat(dfs, ignore_index=True)
    logger.info("Total rows loaded: %d", len(combined))
    return combined


def preprocess(df: pd.DataFrame) -> tuple:
    """Clean and prepare feature matrix and labels."""
    # Find label column
    label_col = next((c for c in df.columns if c.strip() == "Label"), None)
    if label_col is None:
        raise ValueError("No 'Label' column found in dataset")

    labels = df[label_col].str.strip()

    # Find available features
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    logger.info("Using %d / %d feature columns", len(available_features), len(FEATURE_COLS))

    X = df[available_features].copy()

    # Clean data
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(0)

    # Clip extreme values
    for col in X.columns:
        q99 = X[col].quantile(0.99)
        X[col] = X[col].clip(upper=q99 * 10)

    return X, labels, available_features


def train_models(data_dir: str, model_dir: str):
    """Full training pipeline."""
    model_path = Path(model_dir)
    model_path.mkdir(parents=True, exist_ok=True)

    # Load data
    logger.info("Loading CIC-IDS2017 dataset from %s", data_dir)
    df = load_cicids2017(data_dir)

    # Preprocess
    X, y_raw, feature_names = preprocess(df)

    # Encode labels
    le = LabelEncoder()
    y = le.fit_transform(y_raw)
    classes = le.classes_.tolist()
    logger.info("Label classes: %s", classes)
    logger.info("Class distribution:\n%s", y_raw.value_counts())

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    logger.info("Train: %d, Test: %d", len(X_train), len(X_test))

    # --- Random Forest ---
    logger.info("Training RandomForestClassifier...")
    rf = RandomForestClassifier(
        n_estimators=100, n_jobs=-1, random_state=42,
        max_depth=20, min_samples_split=5, class_weight="balanced"
    )
    rf.fit(X_train, y_train)
    y_pred_rf = rf.predict(X_test)
    rf_acc = accuracy_score(y_test, y_pred_rf)
    logger.info("Random Forest Accuracy: %.4f", rf_acc)
    logger.info("\n%s", classification_report(y_test, y_pred_rf, target_names=classes, zero_division=0))

    joblib.dump(rf, model_path / "rf_classifier.joblib")
    logger.info("Saved RandomForest model")

    # --- XGBoost ---
    logger.info("Training XGBClassifier...")
    xgb = XGBClassifier(
        n_estimators=100, max_depth=8, learning_rate=0.1,
        n_jobs=-1, random_state=42, eval_metric="mlogloss",
        tree_method="hist", use_label_encoder=False
    )
    xgb.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    y_pred_xgb = xgb.predict(X_test)
    xgb_acc = accuracy_score(y_test, y_pred_xgb)
    logger.info("XGBoost Accuracy: %.4f", xgb_acc)

    joblib.dump(xgb, model_path / "xgb_classifier.joblib")
    logger.info("Saved XGBoost model")

    # --- Isolation Forest (anomaly detection, train on BENIGN only) ---
    logger.info("Training IsolationForest on benign traffic...")
    benign_mask = y_raw == "BENIGN"
    X_benign = X[benign_mask].sample(min(len(X[benign_mask]), 20000), random_state=42)
    iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42, n_jobs=-1)
    iso.fit(X_benign)
    joblib.dump(iso, model_path / "iso_forest.joblib")
    logger.info("Saved IsolationForest model")

    # Save metadata
    meta = {
        "feature_names": feature_names,
        "label_classes": classes,
        "rf_accuracy": rf_acc,
        "xgb_accuracy": xgb_acc,
        "train_size": len(X_train),
        "test_size": len(X_test),
    }
    with open(model_path / "model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    logger.info("All models saved to %s", model_dir)
    return meta


if __name__ == "__main__":
    import sys
    data_dir = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\charu\CIC-IDS2017"
    model_dir = sys.argv[2] if len(sys.argv) > 2 else "./data/models"
    train_models(data_dir, model_dir)
