from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone

from db.mongodb import users_col, refresh_tokens_col
from db.user_models import (
    UserRecord, RegisterRequest, LoginRequest,
    TokenResponse, RefreshRequest, UserPublic,
)
from core.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_refresh_token,
)
from api.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest):
    # Validate input
    if len(payload.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    if len(payload.username.strip()) < 2:
        raise HTTPException(400, "Username must be at least 2 characters.")

    # Check email uniqueness
    existing = await users_col().find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(409, "An account with this email already exists.")

    # Check username uniqueness
    existing_name = await users_col().find_one({"username": payload.username})
    if existing_name:
        raise HTTPException(409, "This username is already taken.")

    # Create user
    user = UserRecord(
        email=payload.email.lower().strip(),
        username=payload.username.strip(),
        hashed_password=hash_password(payload.password),
    )
    await users_col().insert_one(user.model_dump())

    # Create index on email for fast lookups (idempotent)
    await users_col().create_index("email", unique=True)

    # Issue tokens
    access  = create_access_token(user.id, user.username)
    refresh = create_refresh_token(user.id)

    # Store refresh token in MongoDB (hashed)
    await refresh_tokens_col().insert_one({
        "user_id":    user.id,
        "token":      refresh,
        "created_at": datetime.now(timezone.utc),
    })

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        username=user.username,
        user_id=user.id,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    user = await users_col().find_one({"email": payload.email.lower()})

    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.get("is_active", True):
        raise HTTPException(403, "Account is disabled.")

    access  = create_access_token(user["id"], user["username"])
    refresh = create_refresh_token(user["id"])

    await refresh_tokens_col().insert_one({
        "user_id":    user["id"],
        "token":      refresh,
        "created_at": datetime.now(timezone.utc),
    })

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        username=user["username"],
        user_id=user["id"],
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest):
    user_id = decode_refresh_token(payload.refresh_token)
    if not user_id:
        raise HTTPException(401, "Invalid or expired refresh token.")

    # Check token exists in DB (not revoked)
    stored = await refresh_tokens_col().find_one({
        "user_id": user_id,
        "token":   payload.refresh_token,
    })
    if not stored:
        raise HTTPException(401, "Refresh token revoked or not found.")

    user = await users_col().find_one({"id": user_id})
    if not user:
        raise HTTPException(401, "User not found.")

    # Rotate — delete old, issue new
    await refresh_tokens_col().delete_one({"token": payload.refresh_token})
    new_access  = create_access_token(user["id"], user["username"])
    new_refresh = create_refresh_token(user["id"])

    await refresh_tokens_col().insert_one({
        "user_id":    user["id"],
        "token":      new_refresh,
        "created_at": datetime.now(timezone.utc),
    })

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        username=user["username"],
        user_id=user["id"],
    )


@router.post("/logout")
async def logout(
    payload: RefreshRequest,
    current_user: dict = Depends(get_current_user),
):
    """Revoke the refresh token."""
    await refresh_tokens_col().delete_one({"token": payload.refresh_token})
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserPublic(**current_user)
