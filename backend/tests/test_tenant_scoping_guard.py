"""Static guard: every router query on a tenant-bearing model is tenant-scoped (R-83 step 1).

Walks the AST of `app/api/*.py`, finds each `db.query(...)` that mentions a
model with a `tenant_id` column, and requires the enclosing statement to go
through `scoped()` / `get_or_404()` or to spell `tenant_id ==` itself. The
few deliberate exceptions (lookups by email, refresh-token jti, portal token)
are listed in ALLOWLIST with a reason, and each entry must still match so
the list cannot rot.
"""

import ast
import pathlib

import app.models as models

API_DIR = pathlib.Path(__file__).resolve().parents[1] / "app" / "api"

# (file, substring of the statement, why it is safe without a tenant filter)
ALLOWLIST = [
    (
        "auth.py",
        "db.query(User).filter(User.email == data.email)",
        "register/login look a user up by globally unique email; the tenant comes from the row",
    ),
    (
        "auth.py",
        "db.query(RefreshToken).filter(RefreshToken.jti ==",
        "refresh/logout resolve a token by its jti; the tenant comes from the row",
    ),
    (
        "users.py",
        "db.query(User).filter(User.email == data.email)",
        "invite checks that the email is unused across all tenants",
    ),
    (
        "portal.py",
        "filter(Document.portal_token == token)",
        "public portal is keyed by the unguessable portal token instead of a session",
    ),
]

SCOPED_MARKERS = ("scoped(", "get_or_404(", "tenant_id ==")


def _tenant_models() -> set[str]:
    names = set()
    for name in models.__all__:
        cls = getattr(models, name)
        table = getattr(cls, "__table__", None)
        if table is not None and "tenant_id" in table.columns:
            names.add(name)
    return names


def _mentions(node: ast.AST, names: set[str]) -> bool:
    return any(isinstance(n, ast.Name) and n.id in names for n in ast.walk(node))


def _is_db_query(node: ast.Call) -> bool:
    func = node.func
    return (
        isinstance(func, ast.Attribute)
        and func.attr == "query"
        and isinstance(func.value, ast.Name)
        and func.value.id == "db"
    )


def _statements_with_tenant_queries(path: pathlib.Path, names: set[str]) -> list[str]:
    source = path.read_text()
    tree = ast.parse(source, filename=str(path))
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent

    found: dict[int, str] = {}
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and _is_db_query(node)):
            continue
        if not any(_mentions(arg, names) for arg in node.args):
            continue
        expr: ast.AST = node
        while not isinstance(parents[expr], ast.stmt):
            expr = parents[expr]
        stmt = parents[expr]
        # For `if db.query(...)`, `for x in db.query(...)` etc. only the head
        # expression counts — the block body must not be able to satisfy it.
        target = expr if hasattr(stmt, "body") else stmt
        found[target.lineno] = ast.get_source_segment(source, target)
    return [found[line] for line in sorted(found)]


def test_tenant_models_are_detected():
    assert {"Client", "Document", "CompanySettings", "User"} <= _tenant_models()
    assert "Tenant" not in _tenant_models()


def test_every_router_query_on_a_tenant_model_is_scoped():
    names = _tenant_models()
    violations = []
    used_allowlist = set()
    for path in sorted(API_DIR.glob("*.py")):
        for segment in _statements_with_tenant_queries(path, names):
            if any(marker in segment for marker in SCOPED_MARKERS):
                continue
            allowed = [entry for entry in ALLOWLIST if entry[0] == path.name and entry[1] in segment]
            if allowed:
                used_allowlist.update(allowed)
                continue
            violations.append(f"{path.name}: {segment}")

    assert not violations, "unscoped tenant query — use scoped()/get_or_404():\n" + "\n".join(violations)
    stale = [entry for entry in ALLOWLIST if entry not in used_allowlist]
    assert not stale, f"allowlist entries no longer match anything: {stale}"
