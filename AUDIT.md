# Wardrobe UI / UX audit

Verified locally on October 18, 2026, including a 390 × 844 phone viewport and desktop views.

| Check | Result |
| --- | --- |
| Home, Closet, Outfits, Collections, Planner, Packing, Insights, Profile, Weather | All render without broken image assets or horizontal document overflow. |
| Empty states | Centered across their containers; measured horizontal center offset: 0 px on the audited empty views. |
| Garment editing | Inline inside the same garment card. No separate edit dialog. |
| Custom category menu inside inline editor | Visible and within the phone viewport. |
| Category switching | Header DOM node stays the same; only garment content updates. Page entrance motion does not replay. |
| Dropdowns / dates | Custom glass UI; 0 native select elements in audited views. |
| Mobile navigation | Floating glass dock, central Add/Try-On menu, stable selected state. |
| Reduced motion | Decorative Profile animation reports `none` with reduced motion enabled. |
| Weather | Actual selected-city forecast rendered, including current/hourly/daily data and units. No seeded city ships with the project. |
| Wardrobe flows | File selection/storage, custom menus, outfit creation, collections, planner, and packing checked through the UI. Audit-created items and boards were removed afterward; the user's upload and selected weather location were preserved. |
| AI-disabled state | Original uploads remain saved without being presented as finished garment renders. |
| Backend | 13 automated access/session/configuration/recognition/mask tests pass. Provider replies are fixtures in tests; live credentials were not used. |
| Vercel build | Verified from the packaged source structure without Sites metadata. |
| Home weather card | Measured 356 px, matching the full content width on a 390 px phone. |
| Closet viewport | No vertical document scroll at 390 × 844 or 375 × 667. Card ends 18 px above the dock. Desktop also fits the viewport. |
| Custom dashboard icons | Original SVG artwork for Pieces, Looks, and Collections, with matching glass colors and depth. |
| Animate UI motion | CSS recipes applied to press feedback, menus, dialogs and dismissals. Reduced-motion dialogs report no movement; decorative loops pause off screen. |
| Mobile Try-On | Add → Try-On opens correctly at 390 × 844 and 375 × 667. A saved source photo is eligible before recognition finishes. Start is enabled and above the dock. Missing configuration opens an explicit response. |
| Canvas cutout | Browser check passed for transparent background, preserved white fabric and blue print, removed holes, and PNG output. No test garment was added to the user's closet. |
| Local API origin | Requests using localhost are accepted as the same origin; the dev server also supports 127.0.0.1. |

## Deployment checks still required

No provider credentials were supplied to the local test process. Real Gemini contour fidelity and live Lucy video have not been exercised against the providers. Verify after setting `GEMINI_API_KEY`, `WARDROBE_PASSWORD`, and `DECART_API_KEY` for Try-On on Vercel. See GEMINI_SETUP.md.

The photo workflow now produces a transparent cutout of the original garment with a 2.5D tilt effect. It does not generate hidden fabric, an unseen back side, or a full 3D mesh. Storage is browser-local; moving domains requires exporting/restoring a backup.
