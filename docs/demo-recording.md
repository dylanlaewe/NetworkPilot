# Demo recording foundation

Set `NETWORKPILOT_DEMO_MODE=true` only in a local ignored environment file. Demo mode must use the deterministic synthetic profile and `.invalid` recipients from `src/demo/mode.ts`; live Gmail and Apollo construction must fail closed.

The project does not include a browser-video dependency. To avoid adding a large dependency solely for recording, use a manual recording pass after Headquarters approves the final UI: open `/today` at a 1440×900 viewport, verify the **Demo Mode** indicator, refresh the synthetic pipeline, expand a professional and recruiter message, approve, create the mock Gmail draft, use the simulated send, and record a sample reply. Save recordings under ignored `artifacts/recordings/`.

No final showcase video is produced by this release task.
