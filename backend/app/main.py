from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.task_routes import router as task_router

app = FastAPI(
    title="OpsDesk",
    description="A shared team task board that always makes the next action visible.",
)
app.include_router(task_router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}