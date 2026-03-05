# ADR-0001: Tech stack choice

## Status

Accepted

## Context

The goal is to rapidly iterate on a scalable RSS + AI summary web application, with both development and deployment running on Windows.

## Decision

- Use `Python + FastAPI` for the backend.
- Use `React + TypeScript + Vite` for the frontend.
- Use file storage under `data/` for the data layer, without introducing a database.
- Use an OpenAI‑compatible API to integrate with AI summary providers.

## Rationale

- FastAPI is efficient for API development, type hints, and testing.
- The React + TypeScript ecosystem is mature and friendly for multi‑agent iteration.
- File storage is sufficient for the MVP and easy to inspect and migrate.
- An OpenAI‑compatible protocol reduces vendor lock‑in.

## Consequences

- We must define strict data layout and cleanup rules.
- At larger scale we may need to migrate to a database and job queue.
