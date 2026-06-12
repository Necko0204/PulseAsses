# Pulse Assessment Notes

## Phase 1 — Make it run

### Bug 1: Peers not visible simultaneously in multiple windows

**Issue:** When two users are online from different locations (set via DevTools Sensors), each user only sees their own dot on the map. They don't see the other user's dot, even though both are polling and should be receiving peer lists.

**Root Cause:** Type mismatch in Prisma query response mapping. The `/api/poll` route was casting signal types and other response fields incorrectly, causing Prisma to fail when returning the response.

**Solution:** Fixed type casting in `app/api/poll/route.ts`:
- **Line 53:** Changed signal type casting to properly handle the SignalType enum
- **Line 57:** Fixed peer object mapping to ensure all fields are properly typed
- **Line 63:** Corrected the response structure for signals to match PollResponse type

**Steps taken:**
1. Identified that `/api/poll` was returning 500 errors despite valid database connection
2. Updated Prisma client with `npx prisma generate` to regenerate type definitions and ensure type safety
3. Fixed type casting in lines 53, 57, and 63 of the poll route
4. Verified DATABASE_URL was correctly configured with actual Neon password (not `[REDACTED]`)

**Status:** ✅ Partially Fixed. Peers are now visible, but proximity/distance filtering issue remains (see Bug 2).

---

### Bug 2: Peers not visible when geographically close

**Issue:** Even when two users set different mock geolocation coordinates in DevTools Sensors that are relatively close to each other (e.g., nearby cities), they cannot see each other's dots on the map. Only when locations are far apart do the dots appear visible to each other.

**Suspected Cause:** Possible issue with:
- Map zoom level or viewport culling — dots may be rendered off-screen due to zoom/center calculation
- Geolocation privacy offset randomization — the 1–3 km random offset may be placing one user outside the other's visible map area
- Mapbox marker rendering or filtering logic in `WorldMap.tsx`

**Status:** 🔍 Needs investigation.

---

### Bug 3: Messages not received in peer-to-peer chat

**Issue:** When one user sends a chat message, the other connected user cannot receive it. Messages are sent but not delivered over the WebRTC data channel.

**Root Cause:** Variable name mismatch in `lib/webrtc.ts`:
- **Sender** (`sendChat` method, line 177): Sends messages with type field `t: "msg"`
- **Receiver** (`wireDataChannel` method, line 81): Checks for type field `msg.t === "chat"` (looking for `"chat"`, not `"msg"`)

The message type is sent as `"msg"` but the receiver is checking for `"chat"`, so they don't match and messages are silently dropped.

**Location:** `lib/webrtc.ts` line 81 — change `if (msg.t === "chat"` to `if (msg.t === "msg"`

**Status:** ✅ Fixed. Messages now work correctly.

---

## Phase 2 — Make it good

### Design Improvements Completed

**What was changed:**
1. **Entry Gate Page (`app/components/EntryGate.tsx`):**
   - Added starfield background with 100 twinkling stars using deterministic pseudo-random positioning
   - Implemented falling rain/particle effect with blue gradient lines cascading down the screen
   - Removed logo circle and reduced emoji usage for cleaner aesthetic
   - Large gradient "Pulse" title with cyan→blue→purple color progression
   - Three feature pills (Anonymous, Instant, Video) with hover effects
   - CTA button with gradient background and shine effect on hover
   - Smooth fade-in and fade-in-up animations on load
   - Fixed hydration mismatch by using seeded pseudo-random functions instead of Math.random()

2. **Global Styles (`app/globals.css`):**
   - Added animation keyframes (twinkle, fall, fadeIn, fadeInUp, slideInLeft, slideInRight)
   - Improved pulse-dot styling with better transitions
   - Enhanced pulse-me marker styling with proper flexbox centering

3. **Map Markers:**
   - Fixed marker anchor positioning (changed from "bottom" to "center" for proper placement)
   - Improved CSS for pulse-me and pulse-dot elements to render correctly in Mapbox

4. **Chat Box Design + Attachments (`app/components/ChatPanel.tsx`, `app/page.tsx`, `lib/webrtc.ts`):**
   - Redesigned the chat panel with a cleaner dark UI, stranger avatar, live connection status dot, improved message bubbles, and a more polished input area
   - Added a file/photo attachment button to the chat input
   - Added selected-file preview with remove option before sending
   - Added image preview bubbles for photo attachments
   - Added downloadable file bubbles for supported non-image attachments
   - Sent attachments through the existing WebRTC data channel, keeping them peer-to-peer instead of uploading or storing them on the server
   - Added a 512 KB attachment size limit to avoid unreliable large data-channel payloads

**Thinking behind the changes:**
- **Starfield + rain effect:** Creates an immersive, futuristic atmosphere that matches the "global network" concept of Pulse
- **Gradient colors (cyan/blue/purple):** Modern, tech-forward palette that feels premium and inviting
- **Reduced emojis:** Cleaner, more professional look while maintaining personality with strategic emoji use
- **Animations:** Smooth transitions add polish and guide user attention
- **Deterministic randomization:** Solved server/client hydration issues while maintaining visual variety
- **Peer-to-peer attachments:** Keeps the anonymous/no-history promise because photos and files are sent directly between connected users and are not saved by the app

**Status:** ✅ Completed. Entry gate now has a beautiful, immersive design, and the chat box now supports a polished chat experience with peer-to-peer photo/file attachments.

---

## Phase 3 — Make it secure

(To be completed)

---

## Phase 4 — Make it better

(To be completed)
