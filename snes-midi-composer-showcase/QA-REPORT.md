# QA Report — Neo-SPC Composer Studio

Date: 2026-07-21
Status: PASS for the tested static and browser paths

## Static proof

| Check | Result |
|---|---|
| Showcase audit | 0 errors, 0 warnings |
| Catalog | 100 summary rows and 100 valid lazy cue files |
| Cue media | 100 MIDI, 100 OGG and 100 MP3 files present and non-empty |
| Factory Bank | 50 valid representative previews; large bank data available on demand |
| Markup and runtime hooks | 96 unique IDs; no missing JavaScript element hooks |
| JavaScript syntax | PASS with `node --check app.js` |
| Access CSS | Focus-visible and reduced-motion rules present |

## Browser proof

Playwright used system Chrome against `http://127.0.0.1:8787/`.

- Desktop 1440×1000: first cue loaded, Factory Live played, mastered MP3 played, arrow-key tab movement reached Compose, and the page had no horizontal overflow.
- Mobile 390×844: all four tabs fit, all three product steps fit, Listen and Compose had no horizontal overflow, recipe JSON rendered, and a first play moved the user to the workstation.
- Soundbank: lazy data loaded, search for `glass` found Glass Pad, and Neo-16 audition reached `PLAYING F4`.
- Recovery: a zero-result cue search showed a clear reset action.
- Direct link: `?cue=black_banner_kingdom&view=review` opened the requested cue and Review view.
- Direct disk use: `file:///…/index.html` loaded the cue, mastered MP3 and Factory Live with no recorded error.
- Browser console, page and request errors: 0 on the recorded final paths.

## First-load work

The baseline decoded 50,019,051 bytes before interaction. The final first view decoded 686,603 bytes across 10 requests, a 98.63% cut. It loads one 84,768-byte cue payload. Factory Live or Soundbank then loads the large sample and bank files when needed.

## Independent visual read

A fresh reviewer identified the product as a SNES-style music studio and skill showcase. Their first action was `Play Fernway Crossing`. They recalled `Listen → Inspect → Compose`, the cue name, the hardware look, 100 cues and recipe export.

The review also flagged product depth and the distance to mobile work controls. The final mobile play action now starts sound and moves to the workstation. A cropped Compose header appeared in one automated capture; a clean direct-route capture and element bounds showed the full header at 390 px.

## Claim limits

- We did not run Lighthouse or apply network throttling.
- First Live or Soundbank use still loads the full embedded bank. The first screen stays small; real bank use remains a large local transfer.
- Browser proof covers the named flows and viewports. It does not cover every browser, cue or control combination.
