import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import activities, auth, companies, contacts, dashboard, deals, tasks

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.project_name,
    version="0.1.0",
    description=(
        "Authentication, companies, contacts, the deal pipeline, "
        "activity/task tracking, and dashboard aggregates."
    ),
)

# The browser blocks cross-origin calls from the Vite dev server without this.
# Origins come from CORS_ORIGINS in .env; credentials are not used (the token
# travels in an Authorization header, not a cookie).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(contacts.router)
app.include_router(deals.router)
app.include_router(activities.router)
app.include_router(tasks.router)
app.include_router(dashboard.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort handler so unexpected errors never leak a traceback."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
