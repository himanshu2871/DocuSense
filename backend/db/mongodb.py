import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from config import get_settings

settings = get_settings()

_client: AsyncIOMotorClient | None = None


async def connect_db():
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=30000,
    )
    await _client.admin.command("ping")
    print("Connected to MongoDB Atlas")


async def close_db():
    global _client
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    if _client is None:
        raise RuntimeError("Database not initialised. Call connect_db() first.")
    return _client[settings.MONGODB_DB_NAME]


def documents_col():
    return get_db()["documents"]

def sessions_col():
    return get_db()["sessions"]

def scrape_jobs_col():
    return get_db()["scrape_jobs"]

def users_col():
    return get_db()["users"]

def refresh_tokens_col():
    return get_db()["refresh_tokens"]
