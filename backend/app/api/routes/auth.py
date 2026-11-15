"""
SHADOWTRACE - Authentication Routes
Register, login, token refresh, profile management, password reset.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    verify_password_reset_token,
    verify_token,
)
from app.core.config import settings
from app.db.database import get_db
from app.models.models import RefreshToken, User
from app.schemas.schemas import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    TokenRefresh,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> User:
    """Create a new user account."""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("New user registered: %s (id=%s)", user.email, user.id)
    return user


@router.post("/login", response_model=Token)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Authenticate user and return access + refresh tokens."""
    user = db.query(User).filter(User.email == user_credentials.email).first()
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled.",
        )

    access_token = create_access_token(data={"sub": user.id})
    refresh_token_str = create_refresh_token(data={"sub": user.id})

    # Persist refresh token
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_refresh = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=expires_at,
    )
    db.add(db_refresh)
    db.commit()

    logger.info("User logged in: %s", user.email)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
    }


@router.post("/login/form", response_model=Token, include_in_schema=False)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """OAuth2 form-compatible login (used by Swagger UI)."""
    user_cred = UserLogin(email=form_data.username, password=form_data.password)
    return login(user_cred, db)


@router.post("/refresh", response_model=Token)
def refresh_token(token_in: TokenRefresh, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Use a valid refresh token to obtain a new access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )
    try:
        payload = verify_token(token_in.refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id: str = payload.get("sub")
    except Exception:
        raise credentials_exception

    db_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == token_in.refresh_token,
            RefreshToken.user_id == user_id,
        )
        .first()
    )
    if not db_token:
        raise credentials_exception
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(db_token)
        db.commit()
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise credentials_exception

    new_access = create_access_token(data={"sub": user.id})
    new_refresh = create_refresh_token(data={"sub": user.id})

    # Rotate refresh token
    db.delete(db_token)
    new_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(user_id=user.id, token=new_refresh, expires_at=new_expires))
    db.commit()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """
    Initiate password reset flow.
    Always returns success to avoid email enumeration.
    """
    user = db.query(User).filter(User.email == request.email).first()
    if user:
        reset_token = create_password_reset_token(user.email)
        # In a production environment, send this token via email
        # For now we log it at DEBUG level
        logger.debug(
            "Password reset token for %s: %s", user.email, reset_token
        )
        # background_tasks.add_task(send_reset_email, user.email, reset_token)
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Validate reset token and update the user's password."""
    email = verify_password_reset_token(request.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    logger.info("Password reset for user: %s", email)
    return {"message": "Password updated successfully."}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_active_user)) -> User:
    """Return the currently authenticated user's profile."""
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Update the current user's profile."""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name.strip()
    if user_update.password is not None:
        current_user.hashed_password = get_password_hash(user_update.password)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    token_in: TokenRefresh,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, str]:
    """Invalidate the provided refresh token (logout)."""
    db_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == token_in.refresh_token,
            RefreshToken.user_id == current_user.id,
        )
        .first()
    )
    if db_token:
        db.delete(db_token)
        db.commit()
    return {"message": "Logged out successfully."}
