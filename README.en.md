# Autopilot Dev for DSH

A wish-driven engineering plugin for DSH's existing PTC Mode. It extends the BSD-licensed Wish Specializer with semantic anchors, a lightweight Worker ↔ Advisor workflow, evidence-based verification, and independent review. It does not install a research mode or add a replacement agent preset.

See the [Chinese guide](README.md) for installation and configuration, [semantic anchors](docs/KEYWORDS.md) for the actual prompt vocabulary, and [advisor workflow](po06/ADVISOR.md) for tool contracts. Roles are configurable DSH provider/model pairs; by default an unconfigured role follows the current session model, and the independent reviewer uses its own read-only context. The pre-send explainer is a separate setting. The original user message is never rewritten.

Build a local installable archive with `npm pack --ignore-scripts`, install the archive with DSH's plugin manager, restart, and select native PTC. Use a fresh profile when replacing upstream Wish Specializer, since the package identity is retained for compatibility. Run `npm test` for the source regression suite.
