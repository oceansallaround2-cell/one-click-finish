# Restore Characters and Two-Player Co-op

## What will change
- Repair the movement/rotation field mismatch that currently produces invalid player transforms and a `NaN` speed display; remove temporary visibility-test shapes.
- Correct the existing scene TypeScript errors that currently prevent a clean build, while preserving the current island and art direction.
- Add a two-person online room flow with create/join by a four-letter code, character and position updates, a visible partner avatar, and a partner minimap marker.
- Use Lovable Cloud realtime for casual co-op. Cloud must be enabled for this project before the co-op code can connect; no account login or database migration is needed.

## Technical approach
- Keep movement simulation pure and tested; use one realtime channel per room with presence, rate-limited state broadcasts, and remote-avatar interpolation.
- Preserve offline solo play when not in a room. Verify the local scene, build/type errors, movement tests, and room flow as far as the available Cloud connection permits.
