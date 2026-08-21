import { loadFont as loadAlegreyaSans } from '@remotion/google-fonts/AlegreyaSans'
import { continueRender, delayRender } from 'remotion'

/**
 * The one face Next was providing, and only that one.
 *
 * Cinzel is not here on purpose. The app self-hosts it, globals.css declares
 * the @font-face itself, and `video/fonts` is a symlink to `public/fonts` so
 * that the `url("/fonts/…")` in that rule resolves against webpack's context
 * and the real file is bundled. Loading it from Google as well would put two
 * @font-face rules on one family and make which file wins a question about
 * stylesheet ordering. The video is set in the same bytes as the site.
 *
 * Alegreya Sans has no such file to point at — next/font downloads it at build
 * time and defines `--ic-font-sans`, neither of which happens here — so it
 * comes from Google, and src/styles/video.css re-declares the variable that
 * names it. The weights are the ones globals.css asks for; the family has no
 * 600 and the stylesheet already knows that.
 */
const alegreya = loadAlegreyaSans('normal', {
  weights: ['400', '500', '700'],
  subsets: ['latin'],
})

/** Resolves when the family is usable. */
export const fontsReady = alegreya.waitUntilDone()

export const SANS = alegreya.fontFamily

/*
 * Hold every render open until it lands.
 *
 * document.fonts.ready, which the camera waits on before it measures, only
 * promises that the loads the browser has STARTED have settled — it can
 * resolve before an @font-face injected a tick later is even known about. This
 * is the belt to that pair of braces, and it is at module scope so no scene
 * can forget it.
 */
const handle = delayRender('Loading Alegreya Sans')
fontsReady.then(
  () => continueRender(handle),
  (error) => {
    console.error('Alegreya Sans did not load; the sheet will render in a fallback face.', error)
    continueRender(handle)
  },
)
