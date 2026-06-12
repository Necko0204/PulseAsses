# Pulse Assessment Notes

## Phase 1 — Make it run

### Bug: Peers not visible simultaneously in multiple windows

**Issue:** When two users are online from different locations (set via DevTools Sensors), each user only sees their own dot on the map. They don't see the other user's dot, even though both are polling and should be receiving peer lists.

**Location to fix:**
- **Primary:** `app/page.tsx` — the polling effect (lines ~264-283). Specifically, check `POLL_INTERVAL_MS` from `lib/presence.ts`. The polling interval may be too infrequent or not firing correctly.
- **Secondary:** `/api/poll` route in `app/api/poll/route.ts` — verify it's actually returning peers and not filtering them out incorrectly.

**Expected behavior:** Both users should see each other as dots on the map and be able to tap to connect.

**Status:** Not yet fixed.

---

## Phase 2 — Make it good

(To be completed)

---

## Phase 3 — Make it secure

(To be completed)

---

## Phase 4 — Make it better

(To be completed)
