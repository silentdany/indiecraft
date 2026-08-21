import type { Caption } from './lib/captions'
import type { ZoomStop } from './lib/zoom'

/**
 * The edit. Everything tunable in one file.
 *
 * The scenes underneath are plumbing; this is the thing to open when the cut
 * feels wrong. Every time is in seconds and accepts a bare number, `"12.5"`,
 * or `"1:04.5"`.
 *
 * Each act declares its own LENGTH and the video lays them end to end, so
 * making the cinematic two seconds longer pushes everything after it along
 * rather than desynchronising it. Within an act — the camera stops below —
 * times are positions, counted from that act's first frame.
 */

export const FPS = 30

export const CINEMATIC = {
  /**
   * The excerpt, as a filename inside video/public/.
   *
   * Null until the file is there, which renders a slate saying so rather than
   * throwing — an empty public folder should not be a stack trace.
   */
  src: 'cinematic.mp4' as string | null,

  /** Where the excerpt starts inside the source file. */
  trimBefore: '0:00',
  /**
   * How much of it stays on SCREEN.
   *
   * The audio does not stop here — it carries on under the copy. See SOUND,
   * where the picture and the track stop being the same decision.
   */
  duration: '29',

  /**
   * How the clip meets the frame, and the most consequential setting here.
   *
   * The source is 1954x888 — 2.20:1, and only 888 pixels tall.
   *
   *   'cover'    fills the frame, cropping the sides. In the 9:16 cut that
   *              means keeping a quarter of the width and blowing it up 2.16x,
   *              which on an already-compressed source is visible mush.
   *   'contain'  fits the whole scope frame across the width and letterboxes
   *              it. At 1080 wide the source is very slightly downscaled, so
   *              it is as sharp as the file allows — at the cost of a band
   *              rather than a full-bleed image.
   *
   * The landscape cut crops far less either way and looks fine on 'cover'.
   */
  fit: 'contain' as 'cover' | 'contain',

  /**
   * Where the crop sits, as a fraction of the source frame.
   *
   * Only consulted under `fit: 'cover'` — nothing is cropped away under
   * 'contain'. X first, then Y; 0.5/0.42 favours the upper middle, which is
   * where a shot composed for a scope frame usually puts a head.
   */
  focus: [0.5, 0.42] as [number, number],

  /**
   * A slow push-in across the excerpt. 1 disables it.
   *
   * Kept small under `fit: 'contain'`: the whole point of that mode is to sit
   * at roughly native scale, and a 1.3x push throws that away.
   */
  push: 1.06,

  /**
   * Which decoder pulls frames out of the file. An environment question.
   *
   *   'offthread'  Remotion's Rust compositor. Frame-exact, faster, and the
   *                right answer — but the binary needs glibc 2.35, and this
   *                machine's WSL is Ubuntu 20.04 on glibc 2.31. It cannot even
   *                load: the render dies with "GLIBC_2.32 not found".
   *   'html5'      a real <video> element seeked by Chrome. No compositor
   *                involved, so it renders here. Slower, and frame accuracy
   *                depends on the browser's seeking.
   *
   * Flip this to 'offthread' after moving to a distro on glibc 2.35+
   * (Ubuntu 22.04 or newer). Nothing else has to change.
   */
  decoder: 'html5' as 'html5' | 'offthread',

  /** Fade to black before the copy lands. Picture only — the music continues. */
  fadeOut: '0.5',
}

/**
 * The soundtrack: the cinematic's own audio, in two takes.
 *
 * Not one continuous run. The opening take starts with the picture and keeps
 * going after it, so the copy lands over music that is already playing rather
 * than over a silence somebody has to fill. Then the track jumps — the second
 * take drops in with the armory and plays out to the end of the file.
 *
 * The jump is the edit. It is also what sizes the video: the second take's
 * length IS the armory act's length, and the end card starts on the silence
 * after it. Nothing here is a duration somebody typed; the numbers below are
 * positions in the source file and the lengths fall out of them.
 */
export const SOUND = {
  enabled: true,

  /** Where the opening take starts. It runs under the cinematic and the copy. */
  opening: '0:00',

  /**
   * Where the second take starts. It runs under the armory, to the end of the
   * file — so this one number decides how long the product tour is, and moving
   * it earlier is how you buy the tour more time.
   */
  armory: '1:26',

  /**
   * Dead air at the end of the file, to be ignored.
   *
   * The container runs to 1:49.8 but the music stops at 1:47.91 — the last
   * 1.89 seconds are digital silence. Sizing the act to the container put the
   * end of the act nearly two seconds after the end of the music, so the fade
   * below happened during the silence, the music stopped unfaded where it
   * actually ended, and that edge was an audible click followed by two seconds
   * of nothing.
   *
   * Re-measure after swapping the file: `pnpm measure` prints where the audio
   * goes quiet. This is the gap between that and the duration ffprobe reports.
   */
  tail: '1.89',

  /**
   * How loud the second take sits under the copy, 0 to 1.
   *
   * The opening take is the hero and plays at full level; this one is
   * accompaniment. Six lines of explanation over a Blizzard orchestral swell
   * at full blast is two things competing, and the one that loses is the one
   * that explains the product.
   */
  armoryLevel: 0.55,

  /**
   * How long each take takes to arrive and to leave at the jump.
   *
   * The two takes butt up against each other, and splicing two points of the
   * same piece of music at full level is an audible click rather than a cut.
   * Short enough to still read as a hard edit.
   */
  seam: '0.35',

  /**
   * Fade to silence at the very end of the second take.
   *
   * Short on purpose. The take plays out to the file's own ending rather than
   * being stopped mid-phrase, and a long fade would mute the resolution it has
   * been building towards. This is only here so the last few samples are not a
   * hard digital edge.
   *
   * Picture is deliberately not faded with it: the last frame is the end card,
   * and the end card's job is to survive being screenshotted.
   */
  fadeOut: '0.5',
}

/**
 * The turn.
 *
 * Three beats, cut hard. The joke only works if the third one lands as an
 * answer rather than as a third statement, so it gets its own colour and a
 * beat of silence in front of it.
 */
export const HOOK = {
  beats: [
    { line: 'Feeling nostalgic?', hold: '2.0', tone: 'ask' },
    { line: 'No more play time.\nYou have to ship.', hold: '2.6', tone: 'ask' },
    { line: 'But now you can do both!', hold: '2.6', tone: 'answer' },
  ] as const,
}

/**
 * The armory: what the camera looks at, and what the video says while it does.
 *
 * Twenty-four seconds, which is the length of the second take of music —
 * SOUND.armory to the end of the file. Move that cue and this act follows.
 *
 * Stops and captions are two lists rather than one, deliberately. They are
 * timed against each other but they are not the same edit: a caption that
 * needs another half second to read should not drag the camera with it, and a
 * shot worth holding should not need a line of copy to justify the hold. Two
 * of the nine stops carry no caption at all, and that is the point — the
 * opening reveal and the closing drift are there to be looked at.
 *
 * `scale: 1` frames the sheet at exactly the width of the video, whatever the
 * aspect ratio — so one set of stops works for both the vertical and the
 * landscape cut. Everything above 1 is that many times closer.
 *
 * `to` is either a name marked `data-zoom="…"` in src/shots/Sheet.tsx, or
 * `css:` followed by a selector for anything the app renders and this project
 * does not own. Open the studio and every named target is outlined and
 * labelled on the frame; the readout in the corner names the stop that is
 * running. Aim there, not here.
 */
export const ARMORY = {
  /** Only used when the length cannot be read off the music. */
  duration: '22',
  /** The act never collapses below this, however short the second take is. */
  minimum: '8',

  stops: [
    /*
     * Open wide, on the whole thing.
     *
     * The copy has just said "now you can do both" and the next frame has to
     * answer it. A close-up on a stat is not an answer — the answer is the
     * shape: a character sheet, with a person standing in their own gear. It
     * fits the vertical frame exactly at this scale, which is luck worth
     * spending.
     */
    { at: '0', to: 'portrait', scale: 1 },

    /* The headline strip. Four numbers in one move rather than four moves. */
    { at: '2.8', to: 'figures', scale: 1.45, for: '1.1', ease: 'glide' },

    /* The two the product exists to state. Punched, not glided: these are
       statements, and a statement does not drift into frame. */
    { at: '5.6', to: 'level', scale: 2.4, for: '0.55' },
    { at: '8.6', to: 'ilvl', scale: 2.5, for: '0.5' },

    /* Two item names, one from each column. This is the joke landing — a
       domain rating is a fact and a Crown of Distribution is a thing you are
       wearing — and it is unreadable at any wider shot. */
    { at: '11.4', to: 'css:.doll-slot:nth-of-type(1)', scale: 2.4, for: '0.55' },
    { at: '14.1', to: 'css:.doll-col-right .doll-slot:nth-of-type(2)', scale: 2.4, for: '0.55' },

    /* The quest log, and then one quest. It is the only part of the sheet that
       tells you to go and do something, so it earns the last real beat. */
    { at: '16.8', to: 'quests', scale: 1.25, for: '1.2', ease: 'glide' },

    /* Out, slowly, so the music finishes on a camera that has already stopped
       moving and the end card cuts into stillness.

       The punch into a single quest card that used to sit between these two
       went when the act lost two seconds to SOUND.tail. Of everything left it
       was the most repetitive — the wide shot above already shows the log. */
    { at: '19.4', to: 'portrait', scale: 0.95, for: '2.5', ease: 'glide' },
  ] satisfies ZoomStop[],

  /**
   * What the video actually says about itself.
   *
   * Six of these and the product is explained; without them the armory is a
   * very pretty thing nobody can use. Each one is written to be true of the
   * exact frame it appears over — read them next to the stops above, not on
   * their own.
   *
   * The last one ends three seconds before the act does. Nothing is said over
   * the closing pull-out on purpose: the end card is coming, and arriving at
   * it mid-sentence would make it feel like an interruption rather than a
   * conclusion.
   */
  captions: [
    { at: '0.3', until: '3.0', line: 'Every indie founder already has one of these.' },

    /* The credibility line, and it goes early. Everything after it is a game
       mechanic, and a game mechanic laid over numbers nobody vouches for is a
       toy. This is what makes the rest of it mean anything. */
    { at: '3.3', until: '6.0', line: 'Built from their public numbers on TrustMRR.' },

    { at: '6.3', until: '9.0', line: 'Lifetime revenue is XP.\nShip more, level up.' },

    /*
     * The two scores, as a pair.
     *
     * This slot used to read "item level is the month you're actually having",
     * which was reaching for a phrase and landed on something that scans like
     * a word got swapped. The honest sentence is the contrast: level is the
     * lifetime total, item level is what the current MRR is worth. Saying them
     * together also does the previous caption a favour, because "lifetime
     * revenue is XP" only means something once you know what the other number
     * is for.
     */
    {
      at: '9.3',
      until: '11.9',
      line: "Level is what you've earned.\nItem level is what you're earning.",
    },

    { at: '12.2', until: '14.6', line: 'Every stat you report is a piece of gear.' },
    { at: '14.9', until: '17.2', line: 'Better numbers, better loot.' },
    { at: '17.5', until: '20.4', line: 'And the quest log says what to do next.' },
  ] satisfies Caption[],
}

export const END = {
  /**
   * Silent, and short because of it.
   *
   * The music has stopped by the time this appears — that is the point, the
   * track resolves and then the address lands in the quiet. Six seconds of
   * silence was a held breath; four is a full stop.
   */
  duration: '4',
  over: 'World of',
  name: 'INDIECRAFT',
  url: 'indiecraft.quest',
  line: 'Your revenue is XP. Your stats are gear.',
  /* Said twice, once in the tour and once here. The first time is the claim,
     this one is the citation — and the citation is what somebody screenshots
     the card to check. */
  source: 'Numbers from TrustMRR',
}
