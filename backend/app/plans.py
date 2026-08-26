"""Plan definitions and limit enforcement.

Single source of truth for what each plan allows. Add a plan here and it is
available everywhere — no other file needs to change.
"""

from dataclasses import dataclass, field

from fastapi import HTTPException, status


@dataclass(frozen=True)
class Plan:
    key: str
    name: str
    price_chf_month: int
    max_users: int          # -1 = unlimited
    max_clients: int
    max_documents_month: int
    features: frozenset[str] = field(default_factory=frozenset)


PLANS: dict[str, Plan] = {
    "trial": Plan(
        key="trial", name="Trial", price_chf_month=0,
        max_users=2, max_clients=10, max_documents_month=20,
        features=frozenset({"pdf", "portal"}),
    ),
    "starter": Plan(
        key="starter", name="Starter", price_chf_month=19,
        max_users=1, max_clients=50, max_documents_month=100,
        features=frozenset({"pdf", "portal", "email"}),
    ),
    "pro": Plan(
        key="pro", name="Pro", price_chf_month=49,
        max_users=5, max_clients=500, max_documents_month=1000,
        features=frozenset({"pdf", "portal", "email", "recurring", "bulk", "export"}),
    ),
    "business": Plan(
        key="business", name="Business", price_chf_month=99,
        max_users=-1, max_clients=-1, max_documents_month=-1,
        features=frozenset({
            "pdf", "portal", "email", "recurring", "bulk", "export",
            "webhooks", "api", "ai",
        }),
    ),
}

DEFAULT_PLAN = "trial"


def get_plan(key: str | None) -> Plan:
    return PLANS.get(key or DEFAULT_PLAN, PLANS[DEFAULT_PLAN])


def _unlimited(limit: int) -> bool:
    return limit < 0


def enforce_limit(plan_key: str | None, limit_name: str, current_count: int) -> None:
    """Raise 402 when the tenant is at its plan ceiling.

    limit_name is one of: max_users, max_clients, max_documents_month.
    """
    plan = get_plan(plan_key)
    limit = getattr(plan, limit_name)
    if _unlimited(limit) or current_count < limit:
        return
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "error": "plan_limit_reached",
            "plan": plan.key,
            "limit": limit_name,
            "allowed": limit,
            "message": f"Your {plan.name} plan allows {limit}. Upgrade to add more.",
        },
    )


def require_feature(plan_key: str | None, feature: str) -> None:
    plan = get_plan(plan_key)
    if feature in plan.features:
        return
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "error": "feature_not_in_plan",
            "plan": plan.key,
            "feature": feature,
            "message": f"'{feature}' is not included in {plan.name}. Upgrade to use it.",
        },
    )
