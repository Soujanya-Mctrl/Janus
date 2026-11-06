<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Janus module locations

Frontend code and installed Next.js documentation live under `frontend/`; read `frontend/node_modules/next/dist/docs/` before changing Next.js code. Backend services live under `backend/`, and Solidity tooling lives under `contracts/`. Run module tasks through the root npm scripts or from the owning directory.

Current cross-module context, architecture and milestone gates live in `shared/README.md`, `shared/CONTEXT.md`, `shared/ARCHITECTURE.md` and `shared/PLAN.md`. Keep these current; historical source documents under `docs/archive/` do not override the current user request. Next.js build output belongs only in `frontend/.next/`.

## Phase synchronization workflow

The user authorizes fetching upstream and pushing completed phases to `origin/main`. During active work, fetch `origin` and `upstream` before each phase and again before publishing a completed phase. Inspect incoming changes, integrate `upstream/main` and `origin/main` without discarding local work, resolve conflicts, and run checks appropriate to the resulting changes. Commit each completed phase with an accurate message and push `main` to `origin`. Never force-push or push to upstream. Do not commit credentials or generated caches. A rejected push requires fetching and integrating the new remote changes before retrying. Report blockers rather than publishing a broken phase. This workflow applies while actively working; it does not imply an unattended background service.
