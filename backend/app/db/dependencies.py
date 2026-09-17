"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db.database import get_db

DbSession = Annotated[Session, Depends(get_db)]
AuthedUser = Annotated[CurrentUser, Depends(get_current_user)]
