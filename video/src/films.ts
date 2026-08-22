import type { Film } from './lib/film'

/**
 * The run-up: four films, then the launch.
 *
 *   Tue 25 Aug   cinematic 1   a phrase and the name. No product, no footage.
 *   Fri 28 Aug   cinematic 2   the concept lands. Still no product.
 *   Tue 01 Sep   gameplay 1    the character sheet. The one that has to land.
 *   Thu 03 Sep   gameplay 2    the ladder.
 *   Tue 08 Sep   launch        the sixty-second cut.
 *
 * The order is an argument, not a schedule. Each film can only say what the
 * one before it has earned: the first buys attention with a sentence, the
 * second spends it explaining, and only then is there a reason to look at a
 * screenshot. Showing the sheet on day one would be a screenshot nobody had a
 * reason to read.
 *
 * All four end on the same last bar of music and the same lockup. Days apart,
 * that reads as a signature rather than as repetition.
 */
export const FILMS: Film[] = [
  {
    id: 'Film-1-Nostalgia',
    posts: '08-25',
    about: 'A phrase and the name. Nothing else.',
    duration: '6',
    /*
     * No footage here, and that is the point rather than a saving.
     *
     * Six seconds of type on black, cold, is a harder thing to scroll past
     * than six seconds of somebody else's cinematic — and it costs nothing in
     * Content ID on the day the campaign has no audience yet to lose.
     */
    beats: [{ line: 'You stopped playing.\nYou never stopped grinding.', hold: '4', tone: 'ask' }],
    end: '2',
  },

  {
    id: 'Film-2-Concept',
    posts: '08-28',
    about: 'The concept, still without showing the product.',
    duration: '11.6',
    sting: { from: '1:10', duration: '2.6' },
    beats: [
      { line: 'Feeling nostalgic?', hold: '2', tone: 'ask' },
      { line: 'Busy building startups?', hold: '2', tone: 'ask' },
      /* The concept, and the first line of the campaign that is an answer
         rather than a question. It gets the butter yellow. */
      { line: 'Your revenue is XP.\nYour stats are gear.', hold: '2.6', tone: 'answer' },
    ],
    end: '2.4',
  },

  {
    id: 'Film-3-Sheet',
    posts: '09-01',
    about: 'The character sheet. The first real look at the product.',
    duration: '17.0',
    /*
     * Gameplay first, then the name, then the product.
     *
     * This film has now been opened three ways. Cold on the rendered sheet,
     * the reveal landed on somebody still working out what they were looking
     * at. Card first, the attention-getter was a label — and a label does not
     * get attention.
     *
     * Three seconds of somebody actually playing does. It is the same hook the
     * first two films use, in the register this half of the campaign is in:
     * films one and two borrow a cutscene, three and four borrow the game.
     * Then the card names the thing, and the rendered shot does the close-ups
     * a 910px grab could never hold.
     */
    sting: {
      src: 'gameplay-1.mp4',
      from: '0',
      duration: '3.4',
      /*
       * 910x1084, so nearly square, and it must not be cropped.
       *
       * `cover` was tried and filled the frame beautifully by cutting away the
       * health bar, the action bars and the minimap — which is to say, every
       * part of the image that makes somebody recognise the game. What was
       * left was a soft brown desert. The recognition IS the shot.
       *
       * So: contained, uncropped, with the bars filled by a blurred copy of
       * the same frame.
       */
      fit: 'contain',
      backdrop: true,
    },
    /*
     * Two beats, and the turn happens between them.
     *
     * The first names the feeling the gameplay just produced, which is what
     * lets the second one land as a reveal rather than as a caption: you are
     * remembering, and then you are told the thing you are remembering has a
     * present tense. One line doing both jobs did neither.
     *
     * Both stay in the body colour. The butter yellow is unspent through the
     * whole run-up and the gold on the end card picks it up — a label in the
     * accent colour would cash that in for nothing.
     */
    beats: [
      { line: 'Remember?', hold: '1.2', tone: 'ask' },
      { line: 'Your character sheet.', hold: '1.3', tone: 'ask' },
    ],
    shot: 'sheet',
    stops: [
      { at: '0', to: 'portrait', scale: 1 },
      { at: '1.3', to: 'figures', scale: 1.45, for: '1', ease: 'glide' },
      { at: '3.2', to: 'level', scale: 2.4, for: '0.55' },
      { at: '5.0', to: 'ilvl', scale: 2.5, for: '0.5' },
      { at: '6.5', to: 'css:.doll-slot:nth-of-type(1)', scale: 2.4, for: '0.55' },
      { at: '7.7', to: 'portrait', scale: 0.95, for: '0.9', ease: 'glide' },
    ],
    /* Nothing that says what the sheet is: the card does that. */
    captions: [
      { at: '0.3', until: '2.9', line: 'Lifetime revenue is XP.' },
      { at: '3.2', until: '5.7', line: "Item level is what you're earning now." },
      { at: '6.0', until: '8.4', line: 'Every stat you report is a piece of gear.' },
    ],
    end: '2.5',
  },

  {
    id: 'Film-4-Ladder',
    posts: '09-03',
    about: 'The ladder. Four thousand founders, already ranked.',
    duration: '16.2',
    /*
     * From 4.5s, not from the top.
     *
     * The first second of this clip reads as a freeze, and it is not one —
     * every frame of the render differs, checked. It is the game: the mage is
     * sitting still on the sand casting, and a stationary camera over a
     * stationary character is indistinguishable from a stuck video. At 4.5s
     * they are mounted and crossing the dunes, which is unmistakably motion.
     */
    sting: { src: 'gameplay-2.mp4', from: '4.5', duration: '3.4', fit: 'contain', backdrop: true },
    /*
     * "The good old days" and not "good old times" — the idiom is the former,
     * and a campaign trading on somebody's memory of a game cannot afford to
     * sound like it half-remembers the language.
     *
     * The second beat was "And the ladder", which was a table of contents:
     * it announced a section rather than making a claim, and "and" made the
     * film sound like the back half of something the viewer had missed. This
     * one is the same shape as film three's — possessive, two words, present
     * tense — so the two posts read as a pair, and it puts the viewer in the
     * ranking instead of pointing at it.
     */
    beats: [
      { line: 'The good old days.', hold: '1.4', tone: 'ask' },
      { line: 'Your rank.', hold: '1.3', tone: 'ask' },
    ],
    shot: 'ladder',
    /*
     * A slow scroll down the list, not a tour of individual rows.
     *
     * The first version punched to 2.2x on row one, then row four, then the
     * heading. Two things were wrong with it. A ladder row is 920px wide and
     * 53px tall, so at 2.2x you see half a row — too close to read across and
     * far too close to see what it is a row OF. And the subject of a
     * leaderboard is never one row: it is the relationship between them, the
     * fact that there is a twelfth and a twenty-eighth. Punching into one
     * destroys the only thing the shot is about.
     *
     * So: full width held, and a drift downward through the rankings, with a
     * push so slow it registers as pressure rather than as movement. The
     * vertical cut is nearly static under it — the page barely overflows the
     * frame — and that is correct there; the wall of ranked names is the
     * image. The landscape cut, which sees ten rows at a time, gets a real
     * scroll out of the same three stops.
     */
    stops: [
      { at: '0', to: 'css:.ladder-row:nth-of-type(1)', scale: 1 },
      { at: '1.5', to: 'css:.ladder-row:nth-of-type(14)', scale: 1.04, for: '3', ease: 'glide' },
      { at: '5.0', to: 'css:.ladder-row:nth-of-type(28)', scale: 1.08, for: '2.6', ease: 'glide' },
    ],
    /*
     * Rewritten, because the first version described the sort order and
     * nobody has ever wanted anything because of a sort order.
     *
     * The order is fact, surprise, itch. The surprise is the whole product:
     * the ranking already happened, and nobody was asked. The itch is left
     * conditional — "where you'd land", not "you're already on it" — because
     * the corpus is TrustMRR's four thousand and a viewer who is not on
     * TrustMRR is genuinely not on this ladder. Promising them a rank they do
     * not have would be the one lie in the campaign.
     */
    captions: [
      { at: '0.3', until: '2.9', line: 'Four thousand founders, ranked.' },
      { at: '3.2', until: '5.4', line: 'None of them signed up for it.' },
      { at: '5.7', until: '7.4', line: "See where you'd land." },
    ],
    end: '2.5',
  },
]

export const filmById = (id: string): Film | undefined => FILMS.find((film) => film.id === id)
