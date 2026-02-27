"""
Churn prediction service.
Loads the trained LightGBM model and StandardScaler from disk.
"""
import os
import io
import logging
from typing import Optional

import numpy as np
import pandas as pd
import joblib
import shap

logger = logging.getLogger(__name__)

ML_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "ml")
MODEL_PATH = os.path.join(ML_DIR, "modelo_churn.pkl")
SCALER_PATH = os.path.join(ML_DIR, "scaler.pkl")
FEATURE_NAMES_PATH = os.path.join(ML_DIR, "feature_names.pkl")

FEATURE_COLUMNS = [
    "vl_nota_sum",
    "custo_medio_mean",
    "qtd_prd_nota_sum",
    "frequencia_compras",
    "ticket_medio",
    "recencia_dias",
    "regiao_EXTERIOR_max",
    "regiao_NORDESTE_max",
    "regiao_NORTE_max",
    "regiao_SUDESTE_max",
    "regiao_SUL_max",
]

COLUMNS_TO_SCALE = [
    "vl_nota_sum",
    "custo_medio_mean",
    "qtd_prd_nota_sum",
    "ticket_medio",
    "recencia_dias",
    "frequencia_compras",
]

ALL_REGIONS = ["EXTERIOR", "NORDESTE", "NORTE", "SUDESTE", "SUL"]
# The reference region (dropped) is CENTRO_OESTE


def get_segmento(prob: float) -> str:
    if prob <= 0.2:
        return "sem_risco"
    elif prob <= 0.4:
        return "baixo"
    elif prob <= 0.6:
        return "medio"
    elif prob <= 0.8:
        return "alto"
    else:
        return "critico"


def detect_regiao_from_row(row: pd.Series) -> str:
    """Detect region from dummy columns or raw 'regiao' column."""
    if "regiao" in row.index and pd.notna(row.get("regiao")):
        return str(row["regiao"]).upper()
    for region in ALL_REGIONS:
        col = f"regiao_{region}_max"
        if row.get(col, False):
            return region
    return "CENTRO_OESTE"


class ChurnPredictor:
    _instance: Optional["ChurnPredictor"] = None

    def __init__(self):
        self.model = None
        self.scaler = None
        self.explainer = None
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. "
                "Run 'python ml/train_model.py' first."
            )
        logger.info("Loading model and scaler...")
        self.model = joblib.load(MODEL_PATH)
        self.scaler = joblib.load(SCALER_PATH)
        self.explainer = shap.TreeExplainer(self.model)
        self._loaded = True
        logger.info("Model loaded successfully.")

    @classmethod
    def get_instance(cls) -> "ChurnPredictor":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _preprocess_raw_csv(self, df_raw: pd.DataFrame) -> pd.DataFrame:
        """Full preprocessing pipeline for raw transaction-level CSV."""
        df = df_raw.copy()

        # Parse dates
        if "dt_nota_fiscal" in df.columns:
            df["dt_nota_fiscal"] = pd.to_datetime(df["dt_nota_fiscal"], errors="coerce")
        if "ultimacompra" in df.columns:
            df["ultimacompra"] = df["ultimacompra"].replace(" ", pd.NaT)
            df["ultimacompra"] = pd.to_datetime(df["ultimacompra"], format="%Y%m%d", errors="coerce")
            df["ultimacompra"].fillna(df["ultimacompra"].mode()[0] if df["ultimacompra"].notna().any() else pd.NaT, inplace=True)

        # Determine meses_sem_compra if not present
        if "meses_sem_compra" not in df.columns and "ultimacompra" in df.columns and "dt_nota_fiscal" in df.columns:
            data_atual = df["dt_nota_fiscal"].max()
            df["meses_sem_compra"] = (data_atual - df["ultimacompra"]).dt.days / 30

        return df

    def _aggregate_by_client(self, df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate transaction-level data to client-level."""
        # Ensure regiao column for region detection
        regiao_col = None
        if "regiao" in df.columns:
            regiao_col = "regiao"

        # Frequency
        frequencia = df.groupby("codcli").size().reset_index(name="frequencia_compras")

        agg_dict = {}
        if "vl_nota" in df.columns:
            agg_dict["vl_nota"] = "sum"
        if "custo_medio" in df.columns:
            agg_dict["custo_medio"] = "mean"
        if "qtd_prd_nota" in df.columns:
            agg_dict["qtd_prd_nota"] = "sum"
        if "meses_sem_compra" in df.columns:
            agg_dict["meses_sem_compra"] = "max"
        if regiao_col:
            agg_dict[regiao_col] = lambda x: x.mode()[0] if len(x) > 0 else "DESCONHECIDO"

        df_client = df.groupby("codcli").agg(agg_dict).reset_index()
        df_client.rename(
            columns={
                "vl_nota": "vl_nota_sum",
                "custo_medio": "custo_medio_mean",
                "qtd_prd_nota": "qtd_prd_nota_sum",
                "meses_sem_compra": "meses_sem_compra_max",
            },
            inplace=True,
        )

        df_client = df_client.merge(frequencia, on="codcli", how="left")
        df_client["ticket_medio"] = df_client["vl_nota_sum"] / df_client["frequencia_compras"]
        df_client["recencia_dias"] = df_client.get("meses_sem_compra_max", pd.Series(0)) * 30

        # Region dummies
        if regiao_col and regiao_col in df_client.columns:
            regiao_values = df_client[regiao_col].str.upper()
        else:
            regiao_values = pd.Series(["DESCONHECIDO"] * len(df_client))

        for region in ALL_REGIONS:
            df_client[f"regiao_{region}_max"] = regiao_values == region

        return df_client

    def _build_features(self, df_client: pd.DataFrame) -> pd.DataFrame:
        """Build final feature matrix, applying scaler."""
        X = pd.DataFrame(index=df_client.index)
        for col in FEATURE_COLUMNS:
            if col in df_client.columns:
                X[col] = df_client[col]
            else:
                X[col] = 0.0

        # Cast bool columns to int
        bool_cols = [c for c in FEATURE_COLUMNS if X[c].dtype == bool]
        X[bool_cols] = X[bool_cols].astype(int)

        X_scaled = X.copy()
        X_scaled[COLUMNS_TO_SCALE] = self.scaler.transform(X[COLUMNS_TO_SCALE])
        return X, X_scaled

    def _compute_shap(self, X_scaled: pd.DataFrame) -> np.ndarray:
        sv = self.explainer.shap_values(X_scaled)
        if isinstance(sv, list):
            return sv[1]  # class 1 (churn)
        return sv

    def predict_from_csv_bytes(self, csv_bytes: bytes) -> list[dict]:
        """Main prediction pipeline for uploaded CSV."""
        self.load()
        df_raw = pd.read_csv(io.BytesIO(csv_bytes))
        df_processed = self._preprocess_raw_csv(df_raw)
        df_client = self._aggregate_by_client(df_processed)
        X_raw, X_scaled = self._build_features(df_client)

        probas = self.model.predict_proba(X_scaled)[:, 1]
        shap_matrix = self._compute_shap(X_scaled)

        results = []
        for i, row in df_client.iterrows():
            idx = df_client.index.get_loc(i)
            prob = float(probas[idx])

            # Recover region
            regiao = "DESCONHECIDO"
            if "regiao" in row.index:
                regiao = str(row["regiao"]).upper()
            else:
                for region in ALL_REGIONS:
                    if row.get(f"regiao_{region}_max", False):
                        regiao = region
                        break

            shap_dict = {
                feat: float(shap_matrix[idx][j])
                for j, feat in enumerate(FEATURE_COLUMNS)
            }

            results.append(
                {
                    "codcli": int(row["codcli"]),
                    "probabilidade_churn": round(prob, 6),
                    "segmento": get_segmento(prob),
                    "vl_nota_sum": float(row.get("vl_nota_sum", 0)),
                    "frequencia_compras": int(row.get("frequencia_compras", 0)),
                    "ticket_medio": float(row.get("ticket_medio", 0)),
                    "recencia_dias": float(row.get("recencia_dias", 0)),
                    "regiao": regiao,
                    "shap_values": shap_dict,
                }
            )

        return results

    def predict_single(self, client_data: dict) -> dict:
        """Predict for a single client record."""
        self.load()
        row = {
            "codcli": client_data["codcli"],
            "vl_nota_sum": client_data.get("vl_nota", 0),
            "custo_medio_mean": client_data.get("custo_medio", 0),
            "qtd_prd_nota_sum": client_data.get("qtd_prd_nota", 0),
            "frequencia_compras": 1,
            "meses_sem_compra_max": client_data.get("meses_sem_compra", 0),
            "regiao": client_data.get("regiao", "DESCONHECIDO"),
        }
        row["ticket_medio"] = row["vl_nota_sum"]
        row["recencia_dias"] = row["meses_sem_compra_max"] * 30

        regiao = str(row["regiao"]).upper()
        for region in ALL_REGIONS:
            row[f"regiao_{region}_max"] = (regiao == region)

        df_client = pd.DataFrame([row])
        X_raw, X_scaled = self._build_features(df_client)

        prob = float(self.model.predict_proba(X_scaled)[:, 1][0])
        shap_matrix = self._compute_shap(X_scaled)
        shap_dict = {
            feat: float(shap_matrix[0][j])
            for j, feat in enumerate(FEATURE_COLUMNS)
        }

        return {
            "codcli": client_data["codcli"],
            "probabilidade_churn": round(prob, 6),
            "segmento": get_segmento(prob),
            "vl_nota_sum": row["vl_nota_sum"],
            "frequencia_compras": row["frequencia_compras"],
            "ticket_medio": row["ticket_medio"],
            "recencia_dias": row["recencia_dias"],
            "regiao": regiao,
            "shap_values": shap_dict,
        }

    def get_feature_importance(self) -> list[dict]:
        """Return global feature importances."""
        self.load()
        importances = self.model.feature_importances_
        return sorted(
            [
                {"feature": feat, "importance": float(imp)}
                for feat, imp in zip(FEATURE_COLUMNS, importances)
            ],
            key=lambda x: x["importance"],
            reverse=True,
        )
