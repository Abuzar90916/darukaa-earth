"""Project request/response schemas.

Field names deliberately match the existing frontend domain types so the React
service layer needs no response reshaping.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import ProjectStatus, ProjectType


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    project_type: ProjectType = ProjectType.carbon
    status: ProjectStatus = ProjectStatus.planning
    country: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    project_type: ProjectType | None = None
    status: ProjectStatus | None = None
    country: str | None = Field(default=None, max_length=120)
    region: str | None = Field(default=None, max_length=120)


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    total_area_hectares: float
    created_by: str
    created_at: datetime
    updated_at: datetime
