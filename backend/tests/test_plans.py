"""Plan limits — pure logic, no database needed."""

import pytest
from fastapi import HTTPException

from app.plans import PLANS, enforce_limit, get_plan, require_feature


def test_every_plan_is_self_consistent():
    for key, plan in PLANS.items():
        assert plan.key == key
        assert plan.price_chf_month >= 0
        for limit in ("max_users", "max_clients", "max_documents_month"):
            value = getattr(plan, limit)
            assert value == -1 or value > 0, f"{key}.{limit} = {value}"


def test_unknown_plan_falls_back_to_trial():
    assert get_plan("nope").key == "trial"
    assert get_plan(None).key == "trial"


def test_under_limit_is_allowed():
    enforce_limit("trial", "max_clients", 9)  # trial allows 10


def test_at_limit_raises_402():
    with pytest.raises(HTTPException) as exc:
        enforce_limit("trial", "max_clients", 10)
    assert exc.value.status_code == 402
    assert exc.value.detail["error"] == "plan_limit_reached"


def test_business_plan_is_unlimited():
    enforce_limit("business", "max_clients", 999_999)


def test_feature_gate():
    require_feature("business", "ai")
    with pytest.raises(HTTPException) as exc:
        require_feature("trial", "ai")
    assert exc.value.status_code == 402
    assert exc.value.detail["error"] == "feature_not_in_plan"
