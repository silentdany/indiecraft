# The launch video

A Remotion project that renders the real Indiecraft components rather than a
screen capture of them. It exists in this repo, next to the app, because it
imports the app: `src/shots/Sheet.tsx` mounts `PaperDoll`, `GearItem`,
`RankPanel` and the rest straight out of `../components`.

That is the whole design decision, and everything else follows from it:

- **A close-up stays sharp.** CSS transforms are applied before the frame is
  rasterised, so a 2.8x punch on a 12px stat is drawn at 2.8x, not upscaled
  from a 1080p recording.
- **The camera can aim by name.** Targets are measured off the live layout, so
  `to: 'ilvl'` keeps finding the item level after the panel around it is
  redesigned.
- **The video cannot quietly go stale.** Re-render it and it shows the UI as it
  is today. A capture shows the UI as it was the afternoon somebody recorded it.

## Getting a video out

```bash
cd video
pnpm install

pnpm studio              # the editor: preview, scrub, aim the camera
pnpm render              # both cuts into out/
pnpm render:vertical     # 1080x1920, for TikTok / Reels / Shorts
pnpm render:landscape    # 1920x1080, for X / YouTube / Product Hunt
```

## The one file to edit

`src/edit.ts`. The cut, the copy, the camera. Everything else is plumbing.

## Dropping the cinematic in

1. Put the excerpt in `video/public/` — say `cinematic.mp4`.
2. In `src/edit.ts`, set `CINEMATIC.src` to `'cinematic.mp4'`.
3. Set `trimBefore` to where it starts in that file, and `duration` to how much
   of it stays on **screen**. Both accept `"1:04.5"` or a number of seconds.
4. `fit` decides how the clip meets the frame, and at this source resolution it
   matters more than anything else here. See below.

Until step 1 happens the first act renders a slate saying so, which is on
purpose — an empty `public/` should not be a stack trace.

The clip is gitignored. It is not ours to commit.

### The music, in two takes

`CINEMATIC.duration` is only the picture. The audio is separate, and it is cut:

| | source | over | level |
| --- | --- | --- | --- |
| opening take | `SOUND.opening` onward | the cinematic **and** the copy | full |
| second take | `SOUND.armory` to the end of the music | the armory | `SOUND.armoryLevel` |
| — | silence | the end card | — |

The opening take outliving the picture is the point: the three lines land over
music that is already playing rather than over a silence somebody has to fill.
Then the track jumps, and the jump is the edit.

The second take is ducked, because it plays under six lines of explanation. A
Blizzard orchestral swell at full blast against copy is two things competing,
and the one that loses is the one that explains the product.

**The second take decides the length of the video.** The armory act runs for
exactly as long as the music has left after `SOUND.armory` — read off the file
at render time — and the end card starts on the silence after it. So to give
the product tour more time, move `SOUND.armory` earlier. Nothing else changes,
and no arithmetic is involved.

`SOUND.seam` fades each take in and out at the jump. Splicing two points of the
same piece at full level is an audible click rather than a cut; a third of a
second is enough to lose it and short enough to still read as a hard edit.

With `SOUND.enabled: false`, or if the file cannot be read, every act falls back
to its declared length.

### `SOUND.tail`, and why it is not zero

**The file is longer than the music in it.** This one runs to 1:49.80, but the
last note is at 1:47.91 and the rest is digital silence. Sizing the act to the
container ran it nearly two seconds past the music: the fade fired during the
silence, so the music stopped unfaded where it actually ended — an audible
click — and then two seconds of nothing before the end card.

`SOUND.tail` is that gap, and `musicFrames` subtracts it. Re-measure after
swapping the file:

```bash
pnpm measure
```

It prints where the audio goes quiet. `SOUND.tail` is the difference between
the last `silence_start` and the duration ffprobe reports.

Worth knowing generally: **verify audio by measuring it, not by listening once.**
`silencedetect` found this in one command, and would have found it before the
first render if it had been pointed at the file.

### The 9:16 crop

The source is 1954x888 — 2.20:1, and only 888 pixels tall. Filling a vertical
frame with `fit: 'cover'` keeps a quarter of the width and blows it up 2.16x,
which on an already-compressed file is visible mush. `fit: 'contain'` fits the
whole scope frame across the width and letterboxes it: a band rather than a
full-bleed image, but as sharp as the file allows. `'contain'` is the default
for that reason. The landscape cut crops far less and is fine either way.

## Aiming the camera

Run `pnpm studio` and open `Act-Armory-Vertical`. Every element the sheet marks
as a target is outlined and labelled on the frame, and the readout in the
bottom-left names the stop that is currently running, the live magnification,
and every target the shot found. None of that appears in a render — it keys off
`getRemotionEnvironment().isStudio`.

A stop looks like this:

```ts
{ at: '2.4', to: 'level', scale: 2.5, for: '0.7' }
```

- `at` — when the move towards this stop begins.
- `to` — the name of an element marked `data-zoom="…"`, or an explicit
  `[x, y]` in fractions of the page.
- `scale` — `1` means "the sheet fills the width of the video", whatever the
  aspect ratio. That is what lets one set of stops serve both cuts.
- `for` — how long the move takes.
- `ease` — `spring` lands with weight, for punching in on a number. `glide` is
  even and slow, for drifting across a wide shot.

To aim at something that is not yet a target, put `data-zoom="whatever"` on it
in `src/shots/Sheet.tsx`.

The camera is clamped to the page: it will not pan past the edge into the void
above the document, so a stop on something near the top reads as "look at the
title" rather than "centre the title and show 900px of nothing".

### `css:` targets

`to: 'css:.doll-slot:nth-of-type(1)'` aims at anything the app renders. The
selector is resolved in the same measurement pass as the named targets, so a
stop cannot tell the difference — but a selector is a guess about somebody
else's DOM, and a wrong one warns to the console and falls back to the wide
shot rather than throwing. Check the still after you write one.

Use it for the item rows: the names are the best writing on the sheet, and
`PaperDoll` is the app's component, so hanging `data-zoom` on them would mean
editing the app to hold the camera's hand.

## What the video says

`ARMORY.captions` — a band across the foot of the frame, timed against the
stops but listed separately:

```ts
{ at: '6.3', until: '9.0', line: 'Lifetime revenue is XP.\nShip more, level up.' }
```

Two lists rather than one, deliberately. A caption that needs another half
second to read should not drag the camera with it, and a shot worth holding
should not need a line of copy to justify the hold — two of the nine stops
carry no caption at all.

Each line is written to be true of the exact frame it appears over. Read them
next to `ARMORY.stops`, not on their own: the point of a band rather than a
full-screen card is that the claim and its proof are in the same image, and a
line that has drifted off its shot loses that and keeps none of it.

`\n` breaks a line by hand. The band sits a tenth of the frame height off the
bottom, clear of the furniture TikTok and Reels paint there.

## The character on screen

`src/data/character.json` is one real character, frozen. Re-freeze it with:

```bash
pnpm snapshot            # whoever has the best gear today
pnpm snapshot marclou    # a specific handle
```

It needs `DATABASE_URL` — the script reads the repo's `.env` files. The avatar
is inlined as a data URI so a render never depends on Twitter's CDN.

It is frozen rather than fetched at render time on purpose: the numbers in a
launch video should be the numbers somebody approved, and re-running that
command is the deliberate act of updating them.

**It is also somebody's real public data.** Before publishing, decide whether
that is the founder you want on the launch video, and consider asking them.

## Four things that will bite

**This machine cannot run the fast decoder.** Remotion's Rust compositor needs
glibc 2.35; this WSL is Ubuntu 20.04 on 2.31, so the binary will not even load
and a render dies with `GLIBC_2.32 not found`. `CINEMATIC.decoder: 'html5'`
sidesteps it by pulling frames through a real `<video>` element in Chrome —
slower, and frame accuracy is the browser's rather than exact. Move to Ubuntu
22.04 or newer and flip it back to `'offthread'`; nothing else changes. Note
that the studio previews fine either way: only rendering needs the compositor.

**The app's components need Next to not be there.** `remotion.config.ts` aliases
`@/` to the repo root and points `next/link` and `next/navigation` at inert
shims in `src/shims/`. If a component you pull into a shot imports some other
part of Next, it needs a shim too.

**Fonts come from two places.** Cinzel is the app's own file — `video/fonts` is
a symlink to `public/fonts` so the `url("/fonts/…")` in globals.css resolves
against webpack's context. Alegreya Sans comes from Google, because next/font
is what normally supplies it. See `src/lib/fonts.ts`.

**The JSX runtime is set by hand.** Remotion reads `jsx` out of tsconfig via
`typescript.sys`, which TypeScript 7 does not expose, so the setting is stated
explicitly in `remotion.config.ts`. Without it every app component dies at
module scope with "React is not defined".

## On the borrowed footage

YouTube's Content ID matches Blizzard cinematics reliably, and the audio track
is the part it matches best — which this edit leans on rather than avoids: the
picture is borrowed for twenty-nine seconds, the music for about forty-one, and
the second take is lifted from the end of the piece. Replacing the audio with
something licensed is the low-risk version of this video; the current edit keeps
it because that is what was asked for.

`SOUND.enabled` is the switch. Turning it off also hands the length back to the
declared act durations, which means `ARMORY.duration` starts mattering again.
