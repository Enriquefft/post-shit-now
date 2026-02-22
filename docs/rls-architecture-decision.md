# RLS Architecture Decision (Row-Level Security)

**Decision Date:** 2026-02-20 (Phase 1, v1.1 Milestone)
**Status:** RLS removed for Neon, app-level filtering implemented

## Executive Summary

Post Shit Now uses app-level filtering instead of database-level RLS (Row-Level Security) for data isolation. This decision was made to ensure compatibility with Neon Postgres, which does not support RLS policies, while maintaining security for multi-user team deployments.

## The Decision

**We removed RLS entirely for Neon compatibility and implemented app-level filtering as the alternative approach.**

**Rationale:**

1. **Neon Postgres Limitation:** Neon's serverless Postgres platform does not support RLS policies. RLS requires database-level policy enforcement which Neon's architecture does not provide.

2. **Simplicity vs. Security Trade-off:** App-level filtering is simpler to implement and test than RLS policies. For a CLI-first application where all database access goes through our TypeScript codebase, app-level filtering provides sufficient security.

3. **Development Velocity:** RLS policies require careful migration testing (drizzle-kit push silently deletes RLS policies). App-level filtering is written in TypeScript alongside business logic, making it easier to test and maintain.

4. **Self-Hosted Postgres Path:** Teams who require RLS (e.g., direct database access, third-party integrations) can use self-hosted Postgres with RLS policies enabled.

## App-Level Filtering Pattern

**How it works:**

All database queries include user/hub scoping in WHERE clauses:

```typescript
// Example: Get posts for a specific user/hub
const posts = await db.query.posts.findMany({
  where: eq(posts.userId, userId), // User-level filtering
});

// Example: Get posts for a specific hub (team context)
const hubPosts = await db.query.posts.findMany({
  where: eq(posts.hubId, hubId), // Hub-level filtering
});

// Example: Multi-hub query for admin users
const allHubPosts = await db.query.posts.findMany({
  where: inArray(posts.hubId, accessibleHubIds), // Admin can see multiple hubs
});
```

**Security properties:**

- All database access goes through our codebase (no direct DB access from client)
- WHERE clauses enforced at query level, not database level
- Hub-scoped isolation: users only see data from hubs they have access to
- Admin scoping: admins see all data within their accessible hubs

**Implementation locations:**

- `src/core/db/` - Query functions with WHERE clauses
- `src/team/` - Hub-based filtering for team operations
- `src/platforms/` - Platform-specific data filtering
- `src/voice/` - Voice profile/entity filtering

## Platform Compatibility

| Platform | RLS Support | Recommended Approach |
|----------|--------------|---------------------|
| **Neon Postgres** | Not supported | Use app-level filtering (default) |
| **Self-hosted Postgres** | Supported | Option 1: App-level filtering (default) |
| **Self-hosted Postgres** | Supported | Option 2: Enable RLS policies (advanced) |

## For Self-Hosted Postgres Users

If you're using self-hosted Postgres and want to enable RLS:

**Option 1: Continue using app-level filtering (recommended)**

- Pros: Simpler, consistent with Neon users, easier debugging
- Cons: Requires all data access through application code

**Option 2: Enable RLS policies (advanced)**

To enable RLS on self-hosted Postgres:

1. **Backup your database** before making schema changes

2. **Enable RLS on tables:**
   ```sql
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
   -- Enable on all tables that require user/hub scoping
   ```

3. **Create RLS policies:**
   ```sql
   -- Example: Users can only see their own posts
   CREATE POLICY user_posts_policy ON posts
       FOR ALL
       TO authenticated_user
       USING (user_id = current_setting('app.current_user_id')::uuid)
       WITH CHECK (user_id = current_setting('app.current_user_id')::uuid);

   -- Example: Admin users can see all posts in their accessible hubs
   CREATE POLICY admin_posts_policy ON posts
       FOR ALL
       TO admin_user
       USING (hub_id = ANY(current_setting('app.accessible_hub_ids')::uuid[]));
   ```

4. **Set user context in application:**
   ```typescript
   // Before running queries, set user context
   await db.execute(`SET LOCAL app.current_user_id = '${userId}'`);
   await db.execute(`SET LOCAL app.accessible_hub_ids = '${JSON.stringify(accessibleHubIds)}'`);
   ```

**Warning:** RLS policies are not tested in our codebase. If you enable RLS, you're responsible for:
- Testing all queries with RLS policies
- Ensuring policy rules match your access control requirements
- Migrating RLS policies when schema changes (drizzle-kit push)

## Migration Guide: From RLS to App-Level Filtering

**Scenario:** You previously used RLS on self-hosted Postgres and are migrating to Neon or want to simplify.

**Steps:**

1. **Audit existing RLS policies:**
   ```sql
   SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

2. **Identify filtering patterns:**
   - Which tables have user_id filtering?
   - Which tables have hub_id filtering?
   - Are there admin override policies?

3. **Remove RLS policies:**
   ```sql
   DROP POLICY IF EXISTS user_posts_policy ON posts;
   DROP POLICY IF EXISTS admin_posts_policy ON posts;
   -- Drop all RLS policies
   ```

4. **Disable RLS on tables:**
   ```sql
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
   -- Disable on all tables
   ```

5. **Add WHERE clauses to queries:**
   - Find all database queries (grep `db.query.` and `db.select().`)
   - Add `where: eq(table.userId, userId)` to user-scoped queries
   - Add `where: eq(table.hubId, hubId)` to hub-scoped queries

6. **Test filtering:**
   - Create test users with different access levels
   - Verify each user sees only their data
   - Verify admins see all data in their accessible hubs

7. **Monitor for data leaks:**
   - Review query logs for queries without WHERE clauses
   - Use Postgres log statements to track data access patterns

## Security Considerations

**App-level filtering security model:**

- **Assumption:** All database access goes through our application code
- **Enforcement point:** TypeScript code at query level
- **Attack surface:** SQL injection (mitigated by Drizzle ORM), code bugs (no RLS fallback)
- **Monitoring:** Application logs show all queries, audit trail available

**RLS security model (if enabled):**

- **Assumption:** Database enforces isolation even if application is compromised
- **Enforcement point:** Postgres database engine
- **Attack surface:** Policy bugs, SET LOCAL context manipulation
- **Monitoring:** Postgres logs show policy violations, database-level audit trail

**Recommendation:** For most use cases (CLI-first application, no direct DB access), app-level filtering provides sufficient security. RLS is recommended only for teams who require defense-in-depth or direct database access.

## References

- **Phase 1 Decision:** Phase 01 - Critical Setup Fixes (C2: Migration RLS policy error)
- **Phase 1 Research:** RLS compatibility with Neon vs self-hosted Postgres
- **Related Issues:** M1 (Migration retry loop), M2 (Hub ID missing)
- **Database Schema:** drizzle/schema.ts - all tables with userId/hubId columns

## FAQ

**Q: Why not use a Postgres-compatible alternative to Neon that supports RLS?**

A: Neon was chosen for serverless scalability, automatic backups, and developer experience. Migration to self-hosted Postgres is an option but requires operational overhead (hosting, backups, scaling).

**Q: Can I use app-level filtering on self-hosted Postgres?**

A: Yes! App-level filtering works on any Postgres instance. You don't need to enable RLS just because it's available.

**Q: Will app-level filtering impact query performance?**

A: Minimal impact. WHERE clauses at the query level are the same filters RLS would apply. The main difference is enforcement point (application vs database).

**Q: What if I have direct database access needs (e.g., analytics tools)?**

A: For direct DB access, you should either:
- Use self-hosted Postgres with RLS enabled
- Create read-only views that apply app-level filtering
- Use application APIs instead of direct DB access

**Q: How do I ensure my WHERE clauses don't miss filtering?**

A: Code review guidelines:
- All queries must have WHERE clause for user/hub scoping
- Use grep to find unfiltered queries: `grep -r "db.query" | grep -v "where:"`
- Add linter rules to enforce WHERE clauses (optional)
