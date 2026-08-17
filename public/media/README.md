# Landing page media

## `hero-product-demo.mp4` (required, not yet added)

The public landing page's hero section (`src/pages/landing/Hero.jsx`) looks
for this file as its background video:

```
public/media/hero-product-demo.mp4
```

Until it exists, the `<video>` element's `onError` handler fires (404), and
the hero gracefully falls back to the static "product glimpse" preview panel
that already ships in `Hero.jsx` — no broken UI, no console-visible error to
visitors.

**Spec for the real asset, when it's produced:**

- **Content**: a short, honest screen-capture of the real Clix product in
  action — e.g. dashboard KPIs, a POS sale being rung up, an inventory list.
  No stock footage, no external/third-party video.
- **Length**: 10-20 seconds, looping seamlessly.
- **Audio**: none — the `<video>` is rendered `muted` regardless, so silent
  source footage keeps the file smaller.
- **Dimensions**: 1280x720 or another 16:9 ratio.
- **Size**: compressed for web, target under 3MB (the element uses
  `preload="none"` and `object-fit: cover`, so it doesn't need to be large).
- **Format**: `.mp4` (H.264) to match the `<source type="video/mp4">` already
  wired up in `Hero.jsx`.

Drop the file at this exact path and the hero will start using it
automatically — no code changes needed.
