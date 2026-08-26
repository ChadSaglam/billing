"""Workspace / subscription endpoints.

This is the SaaS control surface: what plan am I on, how much of it have I
used, and what would upgrading give me.
"""

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_tenant, get_current_user, get_tenant_id
from app.database import get_db
from app.models.client import Client
from app.models.document import Document
from app.models.user import User
from app.plans import PLANS, get_plan

router = APIRouter(prefix="/api/tenant", tags=["tenant"])


class UsageItem(BaseModel):
    used: int
    limit: int  # -1 = unlimited


class PlanRead(BaseModel):
    key: str
    name: str
    price_chf_month: int
    max_users: int
    max_clients: int
    max_documents_month: int
    features: list[str]


class TenantRead(BaseModel):
    id: int
    name: str
    slug: str
    plan: str
    plan_name: str
    status: str
    trial_ends_at: dt.datetime | None
    trial_days_left: int | None
    is_usable: bool
    usage: dict[str, UsageItem]


@router.get("", response_model=TenantRead)
def get_workspace(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
    tenant=Depends(get_current_tenant),
):
    plan = get_plan(tenant.plan)
    month_start = dt.date.today().replace(day=1)

    usage = {
        "users": UsageItem(
            used=db.query(User).filter(User.tenant_id == tenant_id).count(),
            limit=plan.max_users,
        ),
        "clients": UsageItem(
            used=db.query(Client).filter(Client.tenant_id == tenant_id).count(),
            limit=plan.max_clients,
        ),
        "documents_this_month": UsageItem(
            used=db.query(Document)
            .filter(Document.tenant_id == tenant_id, Document.created_at >= month_start)
            .count(),
            limit=plan.max_documents_month,
        ),
    }

    days_left = None
    if tenant.trial_ends_at:
        days_left = max(0, (tenant.trial_ends_at - dt.datetime.utcnow()).days)

    return TenantRead(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        plan=tenant.plan,
        plan_name=plan.name,
        status=tenant.status,
        trial_ends_at=tenant.trial_ends_at,
        trial_days_left=days_left,
        is_usable=tenant.is_usable,
        usage=usage,
    )


@router.get("/plans", response_model=list[PlanRead])
def list_plans():
    """Public price list — drives the pricing page and the upgrade wall."""
    return [
        PlanRead(
            key=p.key,
            name=p.name,
            price_chf_month=p.price_chf_month,
            max_users=p.max_users,
            max_clients=p.max_clients,
            max_documents_month=p.max_documents_month,
            features=sorted(p.features),
        )
        for p in PLANS.values()
    ]


class PlanChange(BaseModel):
    plan: str


@router.post("/plan", response_model=TenantRead)
def change_plan(
    data: PlanChange,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
    tenant=Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    """Switch plan.

    TODO(payments): this is the hook point for Stripe. Today it flips the
    column directly, which is fine while you are pre-revenue — but before
    launch this must only run from a verified provider webhook, never from
    a client request.
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only an admin can change the plan")
    if data.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Unknown plan '{data.plan}'")

    tenant.plan = data.plan
    tenant.status = "active"
    if data.plan != "trial":
        tenant.trial_ends_at = None
    db.commit()
    db.refresh(tenant)
    return get_workspace(db=db, tenant_id=tenant_id, tenant=tenant)
