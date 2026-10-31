# 0013: Roles in the signed user token

**Status:** accepted

## Context
Admins were whoever was listed in `ADMIN_EMAILS`, and each service that guarded an admin
route kept its own copy of the list (identity, code and contest services). Making someone an
admin meant editing environment variables on several services and redeploying them, and the
copies drifted: in production code-service lacked an address the others had, so the admin
page couldn't load that admin's view of projects.

## Decision
- **identity-service owns the role.** Each user record has `role: "user" | "admin"`
  (a Better Auth field users can't set themselves). Admins promote and demote others with
  `POST /users/admin/:userId/role`.
- **The gateway carries it.** It reads the role with the session, caches it with the session,
  and signs it into the per-service user token (ADR 0008) as a `role` claim. Services trust
  only that claim: anything but `"admin"` is an ordinary user, including tokens without one.
- **Changes apply at the next request:** changing a role clears the user's cached sessions
  at the gateway (as a ban does), so the next request is checked again and gets a token with
  the new role.
- **Owners.** `ADMIN_EMAILS` now lives on identity-service only and names the owners: they get
  the admin role on sign-up and at every start, can't be demoted or banned, and nobody can
  change their own role. So the app always keeps an admin able to undo mistakes.

## Alternatives
- **Keep the email list, shared through an environment group:** no drift, but still a
  redeploy per change, and no way for admins to manage admins.
- **Each service asks identity-service whether a user is an admin:** a network call per admin
  request, and every service depends on identity being up.
- **A permissions system** (Better Auth's admin plugin, fine-grained permissions): more than
  two roles need.

## Consequences
- Promoting an admin is a click, effective immediately, with no redeploy.
- Services stay independent: the role arrives signed with the request.
- A demoted admin keeps admin rights for at most one in-flight request; their next request
  has the new role.
