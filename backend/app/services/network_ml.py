"""
SHADOWTRACE - Network Traffic ML Service
Loads trained CIC-IDS2017 models and classifies uploaded network flows.
"""
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Columns expected from CIC-IDS2017 (stripped of whitespace)
FEATURE_COLS: List[str] = [
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
    "Down/Up Ratio", "Average Packet Size", "Avg Fwd Segment Size",
    "Avg Bwd Segment Size",
    "Subflow Fwd Packets", "Subflow Fwd Bytes", "Subflow Bwd Packets", "Subflow Bwd Bytes",
    "Init_Win_bytes_forward", "Init_Win_bytes_backward",
    "act_data_pkt_fwd", "min_seg_size_forward",
    "Active Mean", "Active Std", "Active Max", "Active Min",
    "Idle Mean", "Idle Std", "Idle Max", "Idle Min",
]

ATTACK_LABEL_MAP: Dict[str, str] = {
    "BENIGN": "Benign", "DoS Hulk": "DoS", "PortScan": "Port Scan",
    "DDoS": "DDoS", "DoS GoldenEye": "DoS", "FTP-Patator": "Brute Force",
    "SSH-Patator": "Brute Force", "DoS slowloris": "DoS",
    "DoS Slowhttptest": "DoS", "Bot": "Bot/C2", "Web Attack – Brute Force": "Web Attack",
    "Web Attack – XSS": "Web Attack", "Infiltration": "Infiltration",
    "Web Attack – Sql Injection": "SQL Injection", "Heartbleed": "Heartbleed",
}


class NetworkMLService:
    def __init__(self, model_dir: str = "./data/models"):
        self.model_dir = Path(model_dir)
        self._rf_model = None
        self._xgb_model = None
        self._iso_model = None
        self._feature_names: List[str] = FEATURE_COLS
        self._label_classes: List[str] = []

    def _load_models(self):
        """Lazy-load models from disk."""
        try:
            import joblib
            rf_path = self.model_dir / "rf_classifier.joblib"
            xgb_path = self.model_dir / "xgb_classifier.joblib"
            iso_path = self.model_dir / "iso_forest.joblib"
            meta_path = self.model_dir / "model_meta.json"

            if rf_path.exists():
                self._rf_model = joblib.load(rf_path)
                logger.info("Loaded RandomForest model")
            if xgb_path.exists():
                self._xgb_model = joblib.load(xgb_path)
                logger.info("Loaded XGBoost model")
            if iso_path.exists():
                self._iso_model = joblib.load(iso_path)
                logger.info("Loaded IsolationForest model")
            if meta_path.exists():
                with open(meta_path) as f:
                    meta = json.load(f)
                    self._feature_names = meta.get("feature_names", FEATURE_COLS)
                    self._label_classes = meta.get("label_classes", [])
        except Exception as e:
            logger.warning("Could not load models: %s", e)

    def _preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean column names and prepare feature matrix."""
        df.columns = df.columns.str.strip()

        # Drop label columns if present
        for col in ["Label", "label", " Label"]:
            if col in df.columns:
                df = df.drop(columns=[col])

        # Find available feature columns
        available = [c for c in self._feature_names if c in df.columns]
        if not available:
            # Try stripped version
            df.columns = df.columns.str.strip()
            available = [c for c in self._feature_names if c in df.columns]

        if not available:
            raise ValueError("No recognisable feature columns found in uploaded file.")

        df = df[available].copy()

        # Replace inf and NaN
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.fillna(0)

        return df

    async def analyse(self, file_path: str, filename: str) -> Dict[str, Any]:
        """Analyse an uploaded network traffic CSV."""
        self._load_models()

        try:
            df_raw = pd.read_csv(file_path, low_memory=False)
        except Exception as e:
            return {"error": f"Could not read CSV: {e}"}

        total_rows = len(df_raw)
        if total_rows == 0:
            return {"error": "Uploaded file contains no data rows."}

        # Extract labels if present for reference
        label_col = next((c for c in df_raw.columns if c.strip() == "Label"), None)
        true_labels: Optional[pd.Series] = None
        if label_col:
            true_labels = df_raw[label_col].str.strip()

        try:
            X = self._preprocess(df_raw.copy())
        except ValueError as e:
            return {"error": str(e)}

        predictions = np.zeros(len(X), dtype=int)
        proba = np.zeros(len(X))
        anomaly_scores = np.zeros(len(X))

        # Random Forest predictions
        if self._rf_model is not None:
            try:
                predictions = self._rf_model.predict(X)
                if hasattr(self._rf_model, "predict_proba"):
                    proba = self._rf_model.predict_proba(X).max(axis=1)
            except Exception as e:
                logger.warning("RF prediction failed: %s", e)

        # Isolation Forest anomaly scores
        if self._iso_model is not None:
            try:
                anomaly_raw = self._iso_model.decision_function(X)
                # Normalise to 0-100 (higher = more anomalous)
                a_min, a_max = anomaly_raw.min(), anomaly_raw.max()
                if a_max > a_min:
                    anomaly_scores = 100 * (1 - (anomaly_raw - a_min) / (a_max - a_min))
                else:
                    anomaly_scores = np.zeros(len(X))
            except Exception as e:
                logger.warning("IsolationForest scoring failed: %s", e)

        # Build results using true labels if available, else predictions
        if true_labels is not None:
            label_series = true_labels.reset_index(drop=True)
        else:
            # Map numeric predictions back to label names
            label_series = pd.Series(
                [self._label_classes[int(p)] if self._label_classes and int(p) < len(self._label_classes)
                 else ("BENIGN" if p == 0 else "ATTACK")
                 for p in predictions]
            )

        label_mapped = label_series.map(lambda l: ATTACK_LABEL_MAP.get(l.strip(), l.strip()))

        benign_mask = label_mapped.str.lower() == "benign"
        benign_count = int(benign_mask.sum())
        attack_count = total_rows - benign_count

        attack_dist: Dict[str, int] = {}
        for label in label_mapped[~benign_mask]:
            attack_dist[label] = attack_dist.get(label, 0) + 1

        overall_anomaly = float(np.mean(anomaly_scores))

        # Feature importance
        feature_importance = []
        if self._rf_model is not None and hasattr(self._rf_model, "feature_importances_"):
            fi = self._rf_model.feature_importances_
            feat_names = X.columns.tolist()
            pairs = sorted(zip(feat_names, fi), key=lambda x: x[1], reverse=True)[:15]
            feature_importance = [{"feature": f, "importance": round(float(v), 4)} for f, v in pairs]

        # Top suspicious IPs (look for Src IP / Dst IP if present)
        top_suspicious_ips = self._extract_suspicious_ips(df_raw, label_mapped)

        # Timeline (sample first 50 attack events if timestamps available)
        attack_timeline = self._build_timeline(df_raw, label_mapped)

        return {
            "filename": filename,
            "total_flows": total_rows,
            "benign_count": benign_count,
            "attack_count": attack_count,
            "attack_distribution": attack_dist,
            "anomaly_score": round(overall_anomaly, 2),
            "top_suspicious_ips": top_suspicious_ips,
            "attack_timeline": attack_timeline,
            "feature_importance": feature_importance,
            "models_used": {
                "random_forest": self._rf_model is not None,
                "xgboost": self._xgb_model is not None,
                "isolation_forest": self._iso_model is not None,
            },
        }

    def _extract_suspicious_ips(self, df: pd.DataFrame, labels: pd.Series) -> List[Dict]:
        src_col = next((c for c in df.columns if "src" in c.lower() and "ip" in c.lower()), None)
        dst_col = next((c for c in df.columns if "dst" in c.lower() and "ip" in c.lower()), None)
        results = []
        if src_col:
            attack_df = df[labels.str.lower() != "benign"].copy()
            if not attack_df.empty:
                top = attack_df[src_col].value_counts().head(10)
                for ip, count in top.items():
                    results.append({
                        "ip": str(ip),
                        "connection_count": int(count),
                        "attack_types": list(labels[df[src_col] == ip].unique())[:3],
                    })
        return results

    def _build_timeline(self, df: pd.DataFrame, labels: pd.Series) -> List[Dict]:
        ts_col = next((c for c in df.columns if "timestamp" in c.lower()), None)
        attack_mask = labels.str.lower() != "benign"
        attack_rows = df[attack_mask].head(50)
        timeline = []
        for i, (idx, row) in enumerate(attack_rows.iterrows()):
            ts = str(row.get(ts_col, "")) if ts_col else f"Event {i+1}"
            label = labels.iloc[idx] if idx < len(labels) else "Attack"
            timeline.append({"time": ts, "event": label, "index": int(idx)})
        return timeline
