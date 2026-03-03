"""
Training script for the churn prediction model.
Run this script once to train and save the model and scaler.

Usage:
  python ml/train_model.py                  # treina com parâmetros otimizados
  python ml/train_model.py --tune           # busca automática de hiperparâmetros (Optuna)
  python ml/train_model.py --tune --trials 100  # mais trials = mais preciso
  python ml/train_model.py --force          # re-treina mesmo se o modelo já existir
"""
import os
import sys
import argparse
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, classification_report
import lightgbm as lgb
import optuna

optuna.logging.set_verbosity(optuna.logging.WARNING)

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

# Parâmetros padrão anti-overfit (sem tuning)
DEFAULT_PARAMS = {
    "n_estimators": 500,
    "learning_rate": 0.05,
    "max_depth": 5,
    "num_leaves": 31,
    "min_child_samples": 30,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "reg_alpha": 0.1,
    "reg_lambda": 0.1,
    "class_weight": "balanced",
    "random_state": 42,
    "verbose": -1,
}


def load_and_preprocess(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    df["dt_nota_fiscal"] = pd.to_datetime(df["dt_nota_fiscal"], format="%Y-%m-%d")
    df["ultimacompra"] = df["ultimacompra"].replace(" ", pd.NaT)
    df["ultimacompra"] = pd.to_datetime(df["ultimacompra"], format="%Y%m%d", errors="coerce")
    df["ultimacompra"] = df["ultimacompra"].fillna(df["ultimacompra"].mode()[0])

    # Churn rule: > 545 days without purchase
    data_atual = df["dt_nota_fiscal"].max()
    df["churn"] = df["ultimacompra"].apply(
        lambda x: 1 if pd.notnull(x) and (data_atual - x).days > 545 else 0
    )

    df.drop(["dt_nota_fiscal", "ultimacompra"], axis=1, inplace=True)

    df = pd.get_dummies(df, columns=["regiao"], drop_first=True)
    for col in ["regiao_EXTERIOR", "regiao_NORDESTE", "regiao_NORTE", "regiao_SUDESTE", "regiao_SUL"]:
        if col not in df.columns:
            df[col] = False

    return df


def build_client_features(df: pd.DataFrame) -> pd.DataFrame:
    frequencia = df.groupby("codcli").size().reset_index(name="frequencia_compras")

    agg_cols = {"vl_nota": "sum", "custo_medio": "mean", "qtd_prd_nota": "sum", "churn": "max"}
    for col in ["regiao_EXTERIOR", "regiao_NORDESTE", "regiao_NORTE", "regiao_SUDESTE", "regiao_SUL"]:
        if col in df.columns:
            agg_cols[col] = "max"
    if "meses_sem_compra" in df.columns:
        agg_cols["meses_sem_compra"] = "max"

    df_client = df.groupby("codcli").agg(agg_cols).reset_index()
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


def tune_hyperparameters(X_train: pd.DataFrame, y_train: pd.Series, n_trials: int = 50) -> dict:
    """Busca automática de hiperparâmetros com Optuna + cross-validation."""
    print(f"\nOtimizando hiperparâmetros com Optuna ({n_trials} trials)...")

    def objective(trial):
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 200, 1000),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "num_leaves": trial.suggest_int("num_leaves", 15, 63),
            "min_child_samples": trial.suggest_int("min_child_samples", 20, 100),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
            "class_weight": "balanced",
            "random_state": 42,
            "verbose": -1,
        }
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        scores = cross_val_score(
            lgb.LGBMClassifier(**params), X_train, y_train,
            cv=cv, scoring="roc_auc", n_jobs=-1,
        )
        return scores.mean()

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    print(f"\nMelhor AUC (CV): {study.best_value:.4f}")
    print("Melhores parâmetros:")
    for k, v in study.best_params.items():
        print(f"  {k}: {v}")

    best = study.best_params
    best.update({"class_weight": "balanced", "random_state": 42, "verbose": -1})
    return best


def train(csv_path: str, tune: bool = False, n_trials: int = 50):
    print(f"Carregando dados de {csv_path}...")
    df = load_and_preprocess(csv_path)

    print("Construindo features RFM por cliente...")
    df_client = build_client_features(df)

    X = df_client[FEATURE_COLUMNS]
    y = df_client["churn_max"]

    print(f"\nDataset: {len(X)} clientes | Churn: {y.mean():.1%} | Ativo: {1 - y.mean():.1%}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train = X_train.copy()
    X_test = X_test.copy()
    X_train[COLUMNS_TO_SCALE] = scaler.fit_transform(X_train[COLUMNS_TO_SCALE])
    X_test[COLUMNS_TO_SCALE] = scaler.transform(X_test[COLUMNS_TO_SCALE])

    # Escolhe parâmetros
    if tune:
        model_params = tune_hyperparameters(X_train, y_train, n_trials=n_trials)
    else:
        model_params = DEFAULT_PARAMS.copy()

    # Early stopping: separa 10% do treino como validação interna
    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train, y_train, test_size=0.1, random_state=42, stratify=y_train
    )

    print("\nTreinando LightGBM com early stopping...")
    model = lgb.LGBMClassifier(**model_params)
    model.fit(
        X_tr, y_tr,
        eval_set=[(X_val, y_val)],
        callbacks=[
            lgb.early_stopping(stopping_rounds=50, verbose=False),
            lgb.log_evaluation(period=-1),
        ],
    )
    print(f"Melhor iteração (early stopping): {model.best_iteration_}")

    # Cross-validation no conjunto de treino completo
    print("\nCross-validation 5-fold (treino)...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(
        lgb.LGBMClassifier(**model_params), X_train, y_train,
        cv=cv, scoring="roc_auc", n_jobs=-1,
    )
    print(f"CV AUC:   {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Avaliação no teste
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = model.predict(X_test)
    test_auc = roc_auc_score(y_test, y_pred_proba)
    print(f"Test AUC: {test_auc:.4f}")
    print()
    print(classification_report(y_test, y_pred, target_names=["Ativo", "Churn"]))

    # Diagnóstico de overfit
    train_auc = roc_auc_score(y_tr, model.predict_proba(X_tr)[:, 1])
    gap = train_auc - test_auc
    print(f"Overfit check — Train AUC: {train_auc:.4f} | Test AUC: {test_auc:.4f} | Gap: {gap:.4f}")
    if gap > 0.05:
        print("AVISO: Gap > 0.05 — considere aumentar regularização ou rodar --tune.")
    else:
        print("OK: modelo bem generalizado.")

    # Salva artefatos
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    joblib.dump(FEATURE_COLUMNS, FEATURE_NAMES_PATH)
    print(f"\nModelo salvo em:  {MODEL_PATH}")
    print(f"Scaler salvo em:  {SCALER_PATH}")
    print(f"Features salvas em: {FEATURE_NAMES_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv",
        default=os.path.join(SCRIPT_DIR, "..", "..", "base_churn.csv"),
        help="Caminho para o base_churn.csv",
    )
    parser.add_argument("--tune", action="store_true", help="Ativar busca automática de hiperparâmetros (Optuna)")
    parser.add_argument("--trials", type=int, default=50, help="Número de trials do Optuna (padrão: 50)")
    parser.add_argument("--force", action="store_true", help="Re-treinar mesmo se o modelo já existir")
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        print(f"CSV não encontrado em {args.csv}.")
        sys.exit(0)

    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH) or args.force:
        train(args.csv, tune=args.tune, n_trials=args.trials)
    else:
        print("Modelo já existe. Use --force para re-treinar.")
