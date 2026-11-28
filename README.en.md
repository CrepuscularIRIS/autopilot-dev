# Autopilot Dev for DSH

Wish-driven engineering in native DSH PTC: pre-send intent alignment, asynchronous domain proposals, a low-frequency long-horizon advisor (first automatic check after ten hours), and one independent read-only final code review. The original user text is never rewritten. Roles are configurable provider/model pairs; the example uses GLM, Flash, Kimi and Sol.

The **Wish advisors** conversation view (also available in the right sidebar) shows session-scoped calls, durations, status, proposals, cards and review findings. No domain library is required: the built-in generic lens supports cold starts; explicitly registered Markdown cards can enrich a bound workspace. No private data or model credentials are bundled.

See [installation and configuration](README.md), [domain interface](po06/META-SUPERVISOR.md) and [role model example](examples/profile.patch.yml). Use Node 22+ and npm pack --ignore-scripts, then install the archive via DSH's plugin manager. Run npm test for source regressions. Do not install this fork and upstream Wish Specializer together in the same profile.
