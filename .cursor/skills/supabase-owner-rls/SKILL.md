---
name: supabase-owner-rls
description: Enforces consistent Supabase Row Level Security ownership rules so authenticated users can access only their own rows via auth.uid() = user_id. Use when creating or reviewing Supabase tables, migrations, or RLS policies, especially for per-user data models.
---

# Supabase Owner RLS

## Scope

Apply this skill to tables that represent user-owned data and contain a `user_id` column.  
Skip shared lookup/system tables that are not user-owned.

## Policy Standard

For each user-owned table:

- Ensure `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
- Define authenticated access with ownership checks:
  - `USING (auth.uid() = user_id)` for row visibility and row mutation eligibility
  - `WITH CHECK (auth.uid() = user_id)` for inserted/updated row validity
- Allow service role/admin bypass where appropriate for backend jobs.

## SQL Output Contract

When this skill is invoked, return SQL statements only (no prose), ready for a migration file.

Generate idempotent SQL using `DROP POLICY IF EXISTS` before `CREATE POLICY`.

## Policy Template

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "<table_name> select own" ON public.<table_name>;
CREATE POLICY "<table_name> select own"
ON public.<table_name>
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "<table_name> insert own" ON public.<table_name>;
CREATE POLICY "<table_name> insert own"
ON public.<table_name>
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "<table_name> update own" ON public.<table_name>;
CREATE POLICY "<table_name> update own"
ON public.<table_name>
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "<table_name> delete own" ON public.<table_name>;
CREATE POLICY "<table_name> delete own"
ON public.<table_name>
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

## Service Role / Admin Guidance

Do not add restrictive policies for `service_role`; it bypasses RLS by design in Supabase server-side contexts.

If explicit admin SQL roles are used, add separate admin policies without weakening authenticated ownership policies.

