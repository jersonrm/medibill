# Supabase Migrations

## Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

Example: `20250115120000_add_soft_delete_servicios_medico.sql`

## Workflow

1. Write the SQL migration in this directory
2. Test locally or in a staging Supabase project
3. Execute in Production via Supabase SQL Editor
4. Commit the file to the repo

## Baseline

The current database schema is documented in the audit reports and existing scripts under `apps/web/scripts/`. Those scripts were applied manually before this migration system was adopted and are kept for reference only — they should **not** be re-run.

## Notes

- Always use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency
- Include `COMMENT ON` for new columns
- RLS policies must be added for any new table
