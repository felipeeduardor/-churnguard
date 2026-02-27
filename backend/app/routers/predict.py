from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.predictor import ChurnPredictor
from app.schemas.cliente import ClienteInput, PredictionResponse, FeaturesResponse

router = APIRouter(prefix="/predict", tags=["predict"])
predictor = ChurnPredictor.get_instance()


@router.post("/csv", response_model=PredictionResponse)
async def predict_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    csv_bytes = await file.read()
    if len(csv_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    try:
        results = predictor.predict_from_csv_bytes(csv_bytes)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    return {"total": len(results), "predictions": results}


@router.post("/single")
async def predict_single(cliente: ClienteInput):
    try:
        result = predictor.predict_single(cliente.model_dump())
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

    return result
