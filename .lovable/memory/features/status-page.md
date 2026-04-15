---
name: Status Page
description: Full service breakdown status page at /status showing Website, API, DB, Discord Bot, and Paste system health
type: feature
---
- Route: /status
- Checks 5 services: Website, API/Edge Functions, Database, Discord Bot, Paste System
- Each service shows: name, description, status (operational/degraded/down), latency in ms
- Overall status banner: All Systems Operational / Service Disruption / Partial Degradation
- Manual refresh button with last-checked timestamp
- Uses glass-card styling consistent with the black/white theme
