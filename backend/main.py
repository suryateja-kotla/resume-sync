import os
import sys
from fastapi import FastAPI
from fastapi.concurrency import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from db.seed import seed_database
from routes.routes import router as chat_router

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s:%(lineno)d | %(message)s",
)
logger = logging.getLogger(__name__)

load_dotenv()
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await seed_database()
        logger.info("Database and schema ready.")
        yield
    except Exception:
        logger.exception("Seeding failed")
        sys.exit(1)


app = FastAPI(
    title="Resume Management System",
    description="Backend for resume ingestion, search, and generation.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
