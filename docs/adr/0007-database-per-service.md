# 0007: A database per service, on one cluster

**Status:** accepted (Sessions 3–5)

## Context
Services that share tables or collections can't change their schema or be deployed
independently. Running a cluster per service is too expensive for a hobby deployment.

## Decision
Each service has its own database (`ceditor_auth`, `ceditor_code`, `ceditor_contest`) on one
MongoDB Atlas cluster, and only that service touches it. Data another service needs arrives
in events (strike counts) or HTTP calls through the gateway, never by reading another
service's database. Moving data between services is done by explicit, re-runnable migration
scripts (dry run by default).

## Alternatives
- **One shared database:** easiest joins, but every schema change couples every service.
- **Cluster per service:** full isolation of load and failures; not worth the cost here.

## Consequences
- Services share the cluster's capacity and availability (one noisy service affects others).
- No cross-service joins: the admin view assembles a user's projects and submissions from two
  services.
