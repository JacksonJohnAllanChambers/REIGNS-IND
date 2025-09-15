# Generations: Industrial Revolution

An elegant, swipe-choice narrative strategy game set in the Industrial Revolution. Balance four competing societal stats, climb the social ladder across generations, and survive the consequences of your decisions.

Live demo: https://reigns.jacksonchambers.com/

**One-liner:** A minimalist, mobile-friendly, card-driven game where every left/right choice shifts Wealth, Reputation, Health, and Stability — pushing you toward ascension or collapse.

## Overview
- **Core loop:** Drag or swipe a card left/right to choose; each choice alters multiple stats and advances the story.
- **Multi-class progression:** Start as a `Laborer` and, by hitting thresholds, ascend to `Merchantile`, `Noble`, and ultimately `Royalty`.
- **Tight balance:** Let any stat drop too low (or, for some classes, soar too high) and you trigger unique failure states and endings.
- **Session-based play:** On death or dynasty end, review your outcome and tap “Live Again” to restart instantly.

## Core Mechanics
- **Stats:** `Wealth`, `Reputation`, `Health`, `Stability` with visible bar fills and threshold markers for next/previous milestones.
- **Classes & thresholds:** Each class defines ascension requirements and maximum bar sizes. Threshold markers help you plan risks and rewards.
- **Card choices:** Narrative cards present two options; outcomes are tuned per class via tags (e.g., `laborer`, `merchantile`, `noble`, `royalty`, `opportunity`, `danger`).
- **Endings:** Distinct end screens with title, message, and optional imagery; restart is one click.

## Implementation Highlights
- **Stack:** HTML5 + CSS3 + Vanilla JavaScript (no frameworks, fully client-side, deploys as static site).
- **Responsive UI:** Fixed 2:3 card aspect ratio, image-first card composition with an overlaid gradient text container and large choice hints.
- **Polished feedback:** Subtle drag transforms, left/right swipe feedback halos, and animated stat bar updates.
- **Thematic typography:** Google Font `Merriweather` for narrative text; clean sans-serif for UI elements.
- **Config-first design:** Central class definitions and thresholds in `script.js` gate content and progression via card tags.

## Run Locally (Windows PowerShell)
Quickest path: just open `index.html` in your browser.

For a local static server (recommended for consistent asset loading):

```powershell
cd "c:\Users\Jack Chambers\Documents\GitHub\REIGNS-IND"
py -m http.server 8000
```

Then visit http://localhost:8000

Alternative with Node.js:

```powershell
npx http-server -p 8000
```

## Project Structure
- `index.html`: Game shell and DOM structure
- `style.css`: Responsive layout, stat bars, card composition, end-screen styling
- `script.js`: Game state, class definitions, thresholds, and card interaction logic
- `images/`: Card art and ending imagery
- `CNAME`: Custom domain for GitHub Pages

## Notes
- Designed for quick sessions and mobile touch input; also works with mouse dragging on desktop.
- No build step needed; perfect for GitHub Pages or any static host.

## Credits
Created by Jackson Chambers.
