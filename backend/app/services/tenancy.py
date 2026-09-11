"""Tenant-scoped query helpers (R-48 / R-83 step 1).

Every router used to spell `db.query(Model).filter(Model.tenant_id == tenant_id)`
by hand — one forgotten filter is a cross-tenant leak. `scoped()` is the one
place that filter lives; `tests/test_tenant_scoping_guard.py` fails the build
when a router queries a tenant-bearing model without going through here.
"""

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Query, Session


def scoped(db: Session, model: type[Any], tenant_id: int) -> Query:
    """`db.query(model)` restricted to `tenant_id`. Chain options/joins on it."""
    return db.query(model).filter(model.tenant_id == tenant_id)


def get_or_404(db: Session, model: type[Any], obj_id: int, tenant_id: int, *, detail: str | None = None) -> Any:
    """One row by primary key inside the tenant, or 404.

    A row that exists under another tenant is indistinguishable from a
    missing one — the response must not leak that it exists.
    """
    obj = scoped(db, model, tenant_id).filter(model.id == obj_id).first()
    if obj is None:
        raise HTTPException(status_code=404, detail=detail or f"{model.__name__} not found")
    return obj
