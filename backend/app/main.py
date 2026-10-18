from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers import auth, items

app = FastAPI(
    title="OpsDesk",
    description="Internal operations work-item tracker with teams, roles, audit history and safe concurrent updates.",
)
app.include_router(auth.router)
app.include_router(items.router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}