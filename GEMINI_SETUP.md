# Gemini setup

The recognition prompt and rules are already installed in `worker/garment-prompt.js`. You do not need to create an AI Studio chat, paste a prompt into AI Studio, or train a model.

In Vercel's project environment variables, set:

| Variable | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your Gemini API key, stored as a server secret. |
| `GEMINI_MODEL` | `gemini-3.8-flash` (also the default if omitted). |
| `WARDROBE_PASSWORD` | A password you choose to unlock AI operations in your app. |
| `DECART_API_KEY` | Your Decart key, for live Try-On. Cutouts do not require it. |

Enable the variables for the deployment environment you use (Production, and Preview if testing preview URLs), then redeploy the latest GitHub commit. Environment changes apply to new deployments. Do not put provider keys into public/client environment variables or commit an `.env` file.

The app asks for `WARDROBE_PASSWORD` when an AI operation needs unlocking. This is the password you chose above. Without it, the Vercel AI endpoints intentionally remain unavailable even if both provider keys exist. The status response now distinguishes this condition from a missing API key.

## Upload behavior

1. Save the original photo on the device.
2. Ask Gemini for one main garment's name, category, color, visible pattern and confidence, plus fabric outlines.
3. Validate the response. Reject low confidence, empty/invalid geometry and a mask covering essentially the whole photo.
4. Cut the original pixels with the outlines in the browser. Preserve white fabric, prints, logos and holes; output a transparent PNG.
5. Save the result and display it as a draggable dimensional preview.

The rules instruct Gemini to ignore screenshot controls and instructions inside images; exclude people, skin, hangers and backgrounds; avoid invented brands, materials or hidden details; and use full-image coordinates consistently. The schema and server validation constrain what is accepted. No generative image model is called in this path.

Requests use `store:false` for stateless Interactions API processing. This does not change Google's separate free-tier data-use terms. Free API quotas depend on your account; a quota error preserves the source photo and allows retrying later.

## Verify after deployment

- Add a clear photo of one shirt. Its name and category should fill automatically, with transparent space around the garment.
- Check a white garment and a printed garment. Inspect sleeves, hems and fine details; contour quality depends on the photo and model.
- Open Add → Real-time Try-On on your phone. Choose the saved piece and press Start. Allow the browser camera prompt yourself. Lucy requires the Decart key, service credit and HTTPS.
- A cutout retains only visible source pixels. It is not a generated product photo, a complete 3D model or a reconstruction of hidden fabric.

References: [Gemini segmentation](https://ai.google.dev/gemini-api/docs/image-understanding#segmentation), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [API quotas](https://ai.google.dev/gemini-api/docs/rate-limits).

## Costumy evaluation

[Costumy](https://github.com/cdrinmatane/Costumy) was evaluated for the requested 3D stage. It accepts sewing patterns and simulates them on a body using Python/Blender; it does not reconstruct clothing from an ordinary photo. Its documented built-in design is Aaron, a sleeveless shirt, and its [limitations](https://github.com/cdrinmatane/Costumy/blob/main/docs/About/limitations.md) include sleeves that do not drape correctly. It has not been added as a misleading photo-to-3D integration. The app continues to support genuine self-contained GLB assets through its existing viewer, and uses Gemini cutouts for ordinary uploads.
