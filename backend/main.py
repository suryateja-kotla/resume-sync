import os
import sys
from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from config.email_config import settings
from services.email_service import EmailService
from scheduler.monthly_scheduler import MonthlyScheduler
from scheduler.scheduler_agent import SchedulerAgent
from db.seed import seed_database
from routes.routes import router as chat_router
from routes.auth_routes import router as auth_router
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

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
    email_service = EmailService(settings)
    agent = SchedulerAgent(
        email_service=email_service,
        frontend_update_url=settings.frontend_update_url,
    )
    scheduler = MonthlyScheduler(
        job=agent.run_cycle,
        run_day=settings.scheduler_run_day,
        run_hour=settings.scheduler_run_hour,
        run_minute=settings.scheduler_run_minute,
    )
    scheduler.start()
    app.state.scheduler = scheduler
    try:
        await seed_database()
        logger.info("Database and schema ready.")
        yield
    except Exception:
        logger.exception("Seeding failed")
        sys.exit(1)
    finally:
        await scheduler.stop()


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Resume Management System",
    description="Backend for resume ingestion, search, and generation.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
