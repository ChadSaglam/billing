# CLAUDE.md

Read **[AGENTS.md](./AGENTS.md)** first — it is the single source of truth for
architecture, commands, conventions and the definition of done in this repo.

Fast facts:

- Multi-tenant Swiss invoicing SaaS (ChaDev Platform, product 1 of 2). Never
  assume one company.
- `make check` before you claim a task is finished.
- Tenant scoping through `services/tenancy.py`, Alembic migrations, and
  regenerated API types are mandatory, not optional polish.
- Open work lives in [`ROADMAP.md`](./ROADMAP.md); the generated snapshot is
  [`STATUS.md`](./STATUS.md) — refresh with `make status`.
