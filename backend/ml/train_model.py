"""
Training script for the churn prediction model.
Run this script once to train and save the model and scaler.
Usage: python ml/train_model.py --csv path/to/base_churn.csv
"""
import os
import sys
import argparse
import pandas as pd
import numpy as np
import joblib
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import lightgbm as lgb

# Paths relative to the backend root
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "modelo_churn.pkl")
SCALER_PATH = os.path.join(SCRIPT_DIR, "scaler.pkl")
FEATURE_NAMES_PATH = os.path.join(SCRIPT_DIR, "feature_names.pkl")

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


def load_and_preprocess(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    # Parse dates
    df["dt_nota_fiscal"] = pd.to_datetime(df["dt_nota_fiscal"], format="%Y-%m-%d")
    df["ultimacompra"] = df["ultimacompra"].replace(" ", pd.NaT)
    df["ultimacompra"] = pd.to_datetime(df["ultimacompra"], format="%Y%m%d", errors="coerce")

    # Fill missing ultimacompra with mode
    df["ultimacompra"].fillna(df["ultimacompra"].mode()[0], inplace=True)

    # Churn rule: > 545 days without purchase
    data_atual = df["dt_nota_fiscal"].max()
    df["churn"] = df["ultimacompra"].apply(
        lambda x: 1 if pd.notnull(x) and (data_atual - x).days > 545 else 0
    )

    # Date features
    df["dt_nota_fiscal_year"] = df["dt_nota_fiscal"].dt.year
    df["dt_nota_fiscal_month"] = df["dt_nota_fiscal"].dt.month
    df["dt_nota_fiscal_day"] = df["dt_nota_fiscal"].dt.day
    df["ultimacompra_year"] = df["ultimacompra"].dt.year
    df["ultimacompra_month"] = df["ultimacompra"].dt.month
    df["ultimacompra_day"] = df["ultimacompra"].dt.day
    df.drop(["dt_nota_fiscal", "ultimacompra"], axis=1, inplace=True)

    # Region dummies
    df = pd.get_dummies(df, columns=["regiao"], drop_first=True)

    # Ensure all region dummy columns exist
    for col in ["regiao_EXTERIOR", "regiao_NORDESTE", "regiao_NORTE", "regiao_SUDESTE", "regiao_SUL"]:
        if col not in df.columns:
            df[col] = False

    return df


def build_client_features(df: pd.DataFrame) -> pd.DataFrame:
    frequencia = df.groupby("codcli").size().reset_index(name="frequencia_compras")

    agg_cols = {
        "vl_nota": "sum",
        "custo_medio": "mean",
        "qtd_prd_nota": "sum",
        "churn": "max",
    }
    # Add region columns dynamically
    for col in ["regiao_EXTERIOR", "regiao_NORDESTE", "regiao_NORTE", "regiao_SUDESTE", "regiao_SUL"]:
        if col in df.columns:
            agg_cols[col] = "max"

    # Add meses_sem_compra
    if "meses_sem_compra" in df.columns:
        agg_cols["meses_sem_compra"] = "max"

    df_client = df.groupby("codcli").agg(agg_cols).reset_index()

    # Rename aggregated columns
    df_client.rename(
        columns={
            "vl_nota": "vl_nota_sum",
            "custo_medio": "custo_medio_mean",
            "qtd_prd_nota": "qtd_prd_nota_sum",
            "churn": "churn_max",
            "meses_sem_compra": "meses_sem_compra_max",
            "regiao_EXTERIOR": "regiao_EXTERIOR_max",
            "regiao_NORDESTE": "regiao_NORDESTE_max",
            "regiao_NORTE": "regiao_NORTE_max",
            "regiao_SUDESTE": "regiao_SUDESTE_max",
            "regiao_SUL": "regiao_SUL_max",
        },
        inplace=True,
    )

    df_client = df_client.merge(frequencia, on="codcli", how="left")
    df_client["ticket_medio"] = df_client["vl_nota_sum"] / df_client["frequencia_compras"]
    df_client["recencia_dias"] = df_client.get("meses_sem_compra_max", 0) * 30

    return df_client


def train(csv_path: str):
    print(f"Loading data from {csv_path}...")
    df = load_and_preprocess(csv_path)

    print("Building client features (RFM aggregation)...")
    df_client = build_client_features(df)

    X = df_client[FEATURE_COLUMNS]
    y = df_client["churn_max"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train = X_train.copy()
    X_test = X_test.copy()
    X_train[COLUMNS_TO_SCALE] = scaler.fit_transform(X_train[COLUMNS_TO_SCALE])
    X_test[COLUMNS_TO_SCALE] = scaler.transform(X_test[COLUMNS_TO_SCALE])

    print("Training LightGBM model...")
    model = lgb.LGBMClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=5,
        num_leaves=31,
        min_child_samples=20,
        class_weight="balanced",
        random_state=42,
        verbose=-1,
    )
    model.fit(X_train, y_train)

    from sklearn.metrics import roc_auc_score, classification_report
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = model.predict(X_test)
    auc = roc_auc_score(y_test, y_pred_proba)
    print(f"\nAUC-ROC (test): {auc:.4f}")
    print(classification_report(y_test, y_pred, target_names=["Ativo", "Churn"]))

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    joblib.dump(FEATURE_COLUMNS, FEATURE_NAMES_PATH)
    print(f"\nModel saved to {MODEL_PATH}")
    print(f"Scaler saved to {SCALER_PATH}")
    print(f"Feature names saved to {FEATURE_NAMES_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv",
        default=os.path.join(SCRIPT_DIR, "..", "..", "base_churn.csv"),
        help="Path to the base_churn.csv file",
    )
    args = parser.parse_args()

    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        if not os.path.exists(args.csv):
            print(f"CSV not found at {args.csv}. Skipping training.")
            sys.exit(0)
        train(args.csv)
    else:
        print("Model files already exist. Skipping training.")
