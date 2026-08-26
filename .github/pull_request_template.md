## What changed

<!-- one or two sentences -->

## Checklist

- [ ] Every new query filters on `tenant_id` (see CLAUDE.md)
- [ ] Write endpoints depend on `require_writable_tenant`
- [ ] New/changed endpoints covered in `backend/tests/test_tenant_isolation.py`
- [ ] Schema change has an Alembic migration that downgrades cleanly
- [ ] No secrets, real client names, or real bank details in the diff
- [ ] `npm run generate-api` re-run if the API changed
