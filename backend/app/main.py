from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, predict, model, agent

app = FastAPI(
    title="Churn Prediction API",
    description="SaaS API for customer churn prediction using LightGBM",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(predict.router)
app.include_router(model.router)
app.include_router(agent.router)


@app.get("/")
def root():
    return {"message": "Churn Prediction API", "docs": "/docs"}
