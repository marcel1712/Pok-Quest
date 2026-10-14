-- Read-only inventory of who can do what (T-038): every table/view in `public` with its
-- RLS flag, policies and table-level grants, and every function with its SECURITY
-- DEFINER flag, search_path and EXECUTE grants. Review the output after any migration
-- that adds a table or a function.
--
--   npx supabase db query --linked -f supabase/audit/privileges.sql
select json_build_object(
 'tables', (select json_agg(json_build_object('t', c.relname, 'kind', c.relkind::text, 'rls', c.relrowsecurity,
     'policies', (select json_agg(p.polname::text || ':' || p.polcmd::text) from pg_policy p where p.polrelid = c.oid),
     'anon', (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=c.relname and g.grantee='anon'),
     'auth', (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=c.relname and g.grantee='authenticated'),
     'public', (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=c.relname and g.grantee='PUBLIC')
   ) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v')),
 'functions', (select json_agg(json_build_object('f', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', 'definer', p.prosecdef, 'returns', pg_get_function_result(p.oid),
     'search_path', (select cfg from unnest(p.proconfig) cfg where cfg like 'search_path=%'),
     'exec', (select string_agg(r.grantee, ',' order by r.grantee) from information_schema.routine_privileges r where r.specific_schema='public' and r.specific_name = p.proname || '_' || p.oid and r.grantee in ('anon','authenticated','PUBLIC'))
   ) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
) as audit;
