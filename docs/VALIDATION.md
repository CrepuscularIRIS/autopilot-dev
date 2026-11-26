# Autopilot Dev 0.9.1-autopilot.1 — validation

- `node po06/scripts/run-suites.mjs`: 149 suites / 1529 passing tests, 0 failed, exit 0.
- Tested configurable provider/model routing, observed-session fallback, role selection when roles share a model, native independent review/investigation and the inactive-advisor boundary.
- Isolated native DSH Desktop host: source checkout and unpacked npm artifact both load the default PTC preset, assemble the keyword-based initial Worker context, expose `consult_task`, `advisor_stage` and native subagent tools, and run the stage status tool through PTC `run_code`. No Research/Wish replacement preset.
- `npm pack --ignore-scripts`: package contains the native bundle, client, entry, prompt playbooks and example configuration. No personal workspace, research integrations, recorded sessions, or bundled shell executables.
- The native smoke used a synthetic workspace and did not call a remote inference provider. This does not establish model output quality across all providers, OSes or DSH versions.
