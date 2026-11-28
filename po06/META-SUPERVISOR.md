# Asynchronous collaboration

- Wish: pre-send alignment (two tool rounds in native PTC with the sidecar enabled), separate original user input and suggestions.
- Flash role: event-driven proposals at TODO transitions, first three actual work steps, then 10 steps or two minutes, or repeated failures. One in-flight call per role; quiet on-track or deduplicated replies do not interrupt execution.
- Kimi role: no automatic call before native Goal age reaches 10 hours; then periodic or materially revised Goal checks, up to three per Goal. Explicit independent investigations remain available.
- Sol role: one independent Lite review per nontrivial completed task/Goal, read-only evidence and findings; no stage approval loop.

The native **Wish advisors** conversation tab and right-sidebar tab show the same session-scoped read model. Filter by Wish, Flash, Kimi, Sol. Historical unknown results are not fabricated; skipped model calls are not failures. Polling is limited to the mounted view; no additional model calls.

## Optional domain knowledge library

The [generic lens](lenses/generic.md) works with no installed domain or cards. Flash can generate a draft domain outline for its own task; drafts stay separate and require explicit import to become a curated lens.

Use the existing local same-origin control API. Write requests require the existing x-po06: 1 header. Use your own absolute workspace and library paths; the following is a synthetic example, not a bundled corpus.

    {
      "name": "engineering",
      "text": "API contracts, boundary conditions, reproducibility",
      "source": "Team-reviewed engineering notes",
      "keywords": ["API", "contract"],
      "boundOnly": true,
      "library": {
        "root": "/absolute/local/knowledge",
        "cards": [
          {"id": "contract", "path": "contract.md", "keywords": ["API", "contract"]}
        ]
      }
    }

- POST /po06/api/lens-import: import the object above.
- POST /po06/api/lens-bind: {"cwd":"/absolute/project","name":"engineering"}.
- GET /po06/api/lenses: list registered domains and bindings.
- GET /po06/api/lens-cards?cwd=/absolute/project&query=contract: bounded read of at most two matching registered Markdown cards, with source, SHA-256 and completeness.
- GET /po06/api/collaboration-runs?session=<id>: actual calls for the session.

Registered roots and manifests are local, never bundled. Bound-only domains do not activate for other projects. Invalid/unavailable cards are omitted; the generic pathway remains functional. The advisor distinguishes source claims from actual verified results.
