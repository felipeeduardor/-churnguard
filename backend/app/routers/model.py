from fastapi import APIRouter, HTTPException
from app.services.predictor import ChurnPredictor
from app.schemas.cliente import FeaturesResponse

router = APIRouter(prefix="/model", tags=["model"])
predictor = ChurnPredictor.get_instance()


@router.get("/features", response_model=FeaturesResponse)
def get_features():
    try:
        features = predictor.get_feature_importance()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"features": features}
