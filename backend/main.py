import os
import sys
from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from config.entra_config import settings as entra_settings
from db.seed import seed_database
from routes.admin_routes import public_router as monthly_router
from routes.admin_routes import router as admin_router
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
    # Refuse to start without working SSO config. The previous auth module
    # silently fell back to a hardcoded JWT secret, which meant a missing env
    # var produced a running-but-forgeable app instead of a failed boot.
    entra_settings.validate()
    logger.info(
        "Entra SSO configured — tenant %s, %d admin(s)",
        entra_settings.entra_tenant_id,
        len(entra_settings.admin_email_list),
    )

    # Scheduled work is NOT started here. The directory sync and monthly email
    # are triggered externally by Cloud Scheduler via /api/admin/*.
    #
    # In-process asyncio timers fail both ways on Cloud Run: scaled to zero
    # (the normal idle state) no process exists at the scheduled minute, so
    # the job silently never runs; scaled to several instances, every instance
    # fires its own timer and ~280 employees receive the monthly email two or
    # three times. An external trigger fires exactly once regardless.
    logger.info(
        "Scheduled jobs are externally triggered — POST /api/admin/sync and "
        "/api/admin/run-monthly. Email delivery mode: %s",
        entra_settings.email_delivery_mode,
    )
    if entra_settings.email_delivery_mode.lower() != "graph":
        logger.warning(
            "EMAIL_DELIVERY_MODE=%s — mail will be logged, not sent.",
            entra_settings.email_delivery_mode,
        )

    try:
        await seed_database()
        logger.info("Database and schema ready.")
        yield
    except Exception:
        logger.exception("Seeding failed")
        sys.exit(1)


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
app.include_router(admin_router, prefix="/api")
# Unauthenticated by design — clicked from an email client. The signed,
# period-scoped token in the URL is the credential.
app.include_router(monthly_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
