# Stabilize OUR CITY and make co-op real

## Work in this turn
- Repair the current preview/build failure while preserving the existing island, player characters, missions, shop, coin rewards, and police chase.
- Replace the broken two-channel room flow with one room channel using Realtime presence for online/offline membership and throttled broadcasts for player state.
- Enforce a two-player room limit in the client, add named player status, partner movement/map updates, wanted-level and activity sync, and reconnect/leave cleanup.
- Make the existing gameplay state changes sync between partners where practical; avoid pretending client-only shared progress is authoritative.
- Verify the build signal, movement/room logic tests, and the preview. Report any cross-device behavior that cannot be verified here.

## Not included unless the current code already supports it
- A secure authoritative game server, account identity, persistent shared inventory/economy, voice chat, or a production-grade global open world. Those require server-side room allocation and persistence beyond ephemeral Realtime presence.
- Rebuilding the full city into a new asset-rich world; the current city remains the starting map.
