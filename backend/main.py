import asyncio
import sys

# Windows fix: The default WindowsProactorEventLoopPolicy is required for Playwright.
# Do NOT set WindowsSelectorEventLoopPolicy here.
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import get_settings
from db.mongodb import connect_db, close_db
from api.routes import documents, scraper, chat, sessions
from api.routes.auth import router as auth_router
from api.dependencies import get_current_user

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop      = asyncio.get_event_loop()
    loop_name = type(loop).__name__
    print(f"Active event loop: {loop_name}")
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="RAG App API",
    description="Chat with PDFs and websites — Groq + HuggingFace + ChromaDB + MongoDB",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public routes ─────────────────────────────────────────────────────────────
app.include_router(auth_router)

# ── Protected routes ──────────────────────────────────────────────────────────
app.include_router(documents.router, dependencies=[Depends(get_current_user)])
app.include_router(scraper.router,   dependencies=[Depends(get_current_user)])
app.include_router(chat.router,      dependencies=[Depends(get_current_user)])
app.include_router(sessions.router,  dependencies=[Depends(get_current_user)])


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "model": settings.GROQ_MODEL, "auth": "enabled"}
