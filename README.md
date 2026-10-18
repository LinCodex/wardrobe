# Wardrobe

A responsive personal wardrobe based on your liquid-glass references. No sample wardrobe, fake profile, invented analytics, or example outfits ship with the app.

## Run

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:48321. The development server binds only to this computer. To use your own untracked environment file locally:

```sh
node --env-file=.env scripts/serve.mjs
```

## Deploy to Vercel

Import this folder as a Vercel project. `vercel.json` configures the build, public directory and API routing. Set these server-side environment variables and redeploy:

| Variable | Purpose |
| --- | --- |
| `DECART_API_KEY` | Lucy garment extraction, product renders and real-time Try-On. |
| `GEMINI_API_KEY` | Automatic garment recognition, naming, color and category. |
| `WARDROBE_PASSWORD` | Owner password protecting billable AI endpoints. Choose a strong, unique password. |
| `GEMINI_MODEL` | Optional recognition model override; default `gemini-3.8-flash`. |

You can substitute your own recognition service with `GARMENT_RECOGNITION_URL` and optional `GARMENT_RECOGNITION_KEY`. It receives multipart field `image` and returns `{ "isGarment": true, "name": "…", "category": "Tops", "color": "…" }`. Valid categories are Tops, Bottoms, Outerwear, Dresses, Shoes, Accessories, Other. The endpoint must use HTTPS.

The first AI operation on Vercel asks for your wardrobe password. A signed HttpOnly cookie unlocks AI requests for 24 hours. Permanent provider keys stay on the server. Lucy receives short-lived tokens restricted to its model and your app's origin. Use Vercel Deployment Protection if you also want to restrict access to the app shell.

## Add a garment

Choose Add a piece from the dock, then select a photo. There is no required details form. The app saves the source, recognizes the main garment, asks Lucy Image to isolate and render it, removes connected white background pixels, and stores the result. Drag gently to pan/tilt the garment. Swipe farther or use dots to switch pieces.

This is a lightweight **2.5D garment render**, using one rendered viewpoint and inertial tilt. It is not a reconstructed mesh or an accurate 360° scan of unseen surfaces. A genuine GLB model can optionally be attached through garment options for full rotation and zoom.

Without configured credentials, photos remain saved in a clear waiting state. The app never displays an original screenshot as a finished garment render. Pending processing resumes on opening the app with its services configured. Failed jobs can be retried. Output fidelity depends on the source and provider; live AI results must be verified with your credentials after deployment.

## Try-On

Try-On lives in the central Add menu, not on individual garments. Choose a processed garment and start Lucy. This sends your camera and selected garment to Decart. Leaving the page disconnects the session. Capture downloads the actual returned video frame. There is no fake AR result or invented fit score.

## Storage

Metadata uses browser localStorage; source photos, renders and GLB assets use IndexedDB. This is device- and origin-specific storage, not a cloud account. Export a backup from Profile before moving to a new domain, browser or device, and restore it there. Photos go to AI services for processing; the camera is sent only when starting Try-On. There is no cross-device synchronization.

## Included

Dashboard, garment slideshow, search/category/favorite filters, outfit creation, collections, custom calendar planner, trip packing, real wardrobe counts, profile/preferences, backup/restore, custom menus/date pickers/icons and reduced-motion support. The Lucy SDK and optional GLB viewer load only when needed.

The latest UI uses one integrated garment card with inline corrections, a floating glass dock, animated vector illustrations, a visual Profile, and a local Weather view. Category changes update only the garment card, preserving the header, search field and dock.

Motion follows the [Animate UI skill](https://github.com/imskyleen/animate-ui/tree/main/skills/animate-ui) plain-markup/CSS path. `public/motion.css` shares its timing tokens across press feedback, custom menus and dialog transitions; `public/motion.js` pauses decorative loops off screen and in hidden tabs. This does not load React or the React component library. Home has original SVG artwork for Pieces, Looks and Collections. Closet fits the viewport with an 18 px gap above the mobile dock, while compact inline editors can scroll internally.

## Weather

Choose a city or use your location in Weather. City search and forecasts come from [Open-Meteo](https://open-meteo.com/); no weather key is needed for personal use under its service terms. Current conditions, hourly/day forecasts, temperature units, and sunset/humidity/wind use actual returned data. Browser location is requested only when you press Use my location; coordinates from that flow are rounded before saving and requesting the forecast. The last forecast is cached locally. Location is not inferred from your timezone.

```sh
node --test scripts/backend.test.mjs
npm run build
```

`public/` is the web app, `worker/` contains shared APIs, and `api/index.js` is the Vercel entry point. The build also supports a separate Sites Worker artifact; Sites is not needed for Vercel deployment.

Implementation references: [Decart VTON](https://docs.platform.decart.ai/models/realtime/virtual-try-on), [Decart image editing](https://docs.platform.decart.ai/models/image/image-editing), [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js).
