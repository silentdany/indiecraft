import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import {
  blend,
  type Camera,
  cameraTransform,
  frames,
  seconds,
  WIDE,
  type ZoomStop,
} from '../lib/zoom'

/**
 * The camera.
 *
 * Wrap anything in this and give it stops; it scales and translates the whole
 * subtree so the requested point sits in the middle of the frame. Nothing it
 * contains knows it is being filmed, which is the property that lets the same
 * component be a wide shot here and a close-up two seconds later.
 *
 * Aiming is by name. Mark a thing `data-zoom="ilvl"` — in a wrapper here, or
 * on the real component if it is ours — and a stop can say `to: 'ilvl'`. The
 * position is measured off the live layout in the browser that is doing the
 * rendering, so it is correct by construction rather than by somebody having
 * eyeballed a percentage that a CSS change will quietly invalidate.
 *
 * Open the studio to aim: every named target is outlined and labelled there,
 * and the readout in the corner says which stop is running. None of that is
 * in the render.
 */
export interface ZoomPanProps {
  stops: ZoomStop[]
  /**
   * The layout width of the thing being filmed, when it is not the width of
   * the frame — the character sheet lays out at 960px and gets scaled up.
   * The height is not asked for: it is measured, because a page is however
   * tall its content makes it and hard-coding that number is a standing
   * invitation for the camera to drift the day somebody adds a row.
   */
  contentWidth?: number
  /**
   * Where the camera sits before the first stop, for a shot that opens on a
   * move. Omit it and the camera simply starts already framed on the first
   * stop, which is what a cut is and what most shots want.
   */
  from?: Camera
  background?: string
  style?: CSSProperties
  debug?: boolean
  children: ReactNode
}

/** Prefix that turns a stop's `to` into a CSS selector rather than a name. */
const SELECTOR = 'css:'

interface Measured {
  x: number
  y: number
  width: number
  height: number
}

export function ZoomPan({
  stops,
  contentWidth,
  from,
  background,
  style,
  debug,
  children,
}: ZoomPanProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const contentRef = useRef<HTMLDivElement>(null)
  const [targets, setTargets] = useState<Record<string, Measured>>({})
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [handle] = useState(() => delayRender('Measuring the zoom targets'))
  const showDebug = debug ?? getRemotionEnvironment().isStudio

  useEffect(() => {
    let cancelled = false

    const measure = async () => {
      /*
       * Fonts first, always.
       *
       * The sheet is set in Cinzel and Alegreya Sans, both of which are wider
       * than the fallback they replace. Measuring before they land puts every
       * target a few percent off — which at 1x is invisible and at 3x is the
       * difference between framing the item level and framing the gap next to
       * it. This await is the entire reason the measurement is asynchronous.
       */
      await document.fonts.ready
      if (cancelled) return

      const element = contentRef.current
      if (!element) {
        continueRender(handle)
        return
      }

      /*
       * Load every picture, including the ones nobody can see yet.
       *
       * WowIcon marks its images `loading="lazy"`, which is right for a web
       * page and wrong here: the camera spends the shot far outside the
       * viewport, so Chrome would decline to fetch the very icon a close-up is
       * about to land on. Forcing them eager and waiting is also what stops a
       * frame being captured with half the gear grid still blank.
       *
       * The race is deliberate. These are hotlinked off a CDN that owes us
       * nothing; if it is slow or down, WowIcon's drawn glyph is already
       * sitting behind every square, so a render that continues after two
       * seconds is strictly better than one that hangs.
       */
      const images = [...element.querySelectorAll('img')]
      for (const image of images) image.loading = 'eager'
      await Promise.race([
        Promise.all(
          images.map((image) =>
            image.complete
              ? Promise.resolve()
              : new Promise((done) => {
                  image.addEventListener('load', done, { once: true })
                  image.addEventListener('error', done, { once: true })
                }),
          ),
        ),
        new Promise((done) => setTimeout(done, 2000)),
      ])
      if (cancelled) return

      /*
       * Ratios, not pixels. Both rectangles come back with the camera's
       * current transform already applied, and a uniform scale-plus-translate
       * cancels out of `(child - parent) / parent`. So this is correct on any
       * frame, at any magnification, without undoing the transform first.
       */
      const outer = element.getBoundingClientRect()
      const found: Record<string, Measured> = {}
      const record = (id: string, node: Element) => {
        const rect = node.getBoundingClientRect()
        found[id] = {
          x: (rect.left + rect.width / 2 - outer.left) / outer.width,
          y: (rect.top + rect.height / 2 - outer.top) / outer.height,
          width: rect.width / outer.width,
          height: rect.height / outer.height,
        }
      }

      for (const node of element.querySelectorAll<HTMLElement>('[data-zoom]')) {
        const id = node.dataset.zoom
        if (id) record(id, node)
      }

      /*
       * Selectors, for aiming at things this project does not own.
       *
       * The charming half of the sheet — "Crown of Distribution", "Shroud of
       * Subscription" — is rendered inside PaperDoll, an app component, and
       * putting data-zoom on those rows would mean editing the app to hold the
       * camera's hand. A stop can say `to: 'css:.doll-slot:nth-of-type(3)'`
       * instead, and it is resolved here in the same pass so the rest of the
       * component cannot tell the difference.
       */
      for (const stop of stops) {
        if (typeof stop.to !== 'string' || !stop.to.startsWith(SELECTOR)) continue
        const node = element.querySelector(stop.to.slice(SELECTOR.length))
        if (node) record(stop.to, node)
      }

      /* offsetWidth/offsetHeight are layout pixels and ignore the transform,
         which is exactly what the camera arithmetic needs. */
      setNatural({ width: element.offsetWidth, height: element.offsetHeight })
      setTargets(found)
      continueRender(handle)
    }

    measure()
    return () => {
      cancelled = true
    }
  }, [handle, stops])

  const timeline = useMemo(() => {
    return [...stops]
      .sort((a, b) => seconds(a.at) - seconds(b.at))
      .map((stop) => ({
        stop,
        start: frames(stop.at, fps),
        duration: Math.max(1, frames(stop.for ?? 0.8, fps)),
      }))
  }, [stops, fps])

  const resolve = (stop: ZoomStop): Camera => {
    const scale = stop.scale ?? 1
    if (!stop.to) return { x: 0.5, y: 0.5, scale }
    if (Array.isArray(stop.to)) return { x: stop.to[0], y: stop.to[1], scale }

    const found = targets[stop.to]
    if (!found) {
      /* Before the measurement lands this is simply not known yet, and the
         frame is never shown — delayRender is holding the render open. Only
         warn once the map exists and the name is genuinely absent. */
      if (Object.keys(targets).length > 0) {
        const what = stop.to.startsWith(SELECTOR)
          ? `Nothing matched the selector "${stop.to.slice(SELECTOR.length)}"`
          : `No element marked data-zoom="${stop.to}"`
        console.warn(
          `${what}. Known targets: ${Object.keys(targets).join(', ') || 'none'}. ` +
            'Falling back to the wide shot.',
        )
      }
      return { x: 0.5, y: 0.5, scale }
    }
    return { x: found.x, y: found.y, scale }
  }

  const box = {
    width: contentWidth ?? width,
    height: natural?.height ?? height,
  }

  const index = timeline.reduce((last, entry, i) => (entry.start <= frame ? i : last), -1)
  const active = index >= 0 ? timeline[index] : undefined

  /*
   * Before the first stop there is nothing to interpolate from, and the
   * honest default is the first stop itself: a shot that opens on a close-up
   * should open on it, not spend one frame at some other magnification and
   * then jump. That single frame is invisible while scrubbing and reads as a
   * flash in the render, which is a miserable thing to have to diagnose.
   */
  const opening = from ?? (timeline[0] ? resolve(timeline[0].stop) : WIDE)

  let camera = opening
  if (active) {
    const previous = index >= 1 ? timeline[index - 1] : undefined
    const start = previous ? resolve(previous.stop) : opening
    const end = resolve(active.stop)
    const elapsed = frame - active.start

    const progress =
      (active.stop.ease ?? 'spring') === 'glide'
        ? interpolate(elapsed, [0, active.duration], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.33, 0, 0.15, 1),
          })
        : spring({
            frame: elapsed,
            fps,
            durationInFrames: active.duration,
            // Enough overshoot to land with some weight, not enough to wobble.
            config: { damping: 26, stiffness: 130, mass: 1 },
          })

    camera = blend(start, end, progress)
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background, ...style }}>
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: box.width,
          transformOrigin: '0 0',
          transform: cameraTransform(camera, { width, height }, box),
        }}
      >
        {children}
        {showDebug &&
          Object.entries(targets).map(([id, rect]) => (
            <div
              key={id}
              style={{
                position: 'absolute',
                left: `${(rect.x - rect.width / 2) * 100}%`,
                top: `${(rect.y - rect.height / 2) * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                outline: '2px dashed rgba(248, 183, 0, 0.9)',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -22,
                  left: 0,
                  font: '600 14px ui-monospace, monospace',
                  color: '#170e09',
                  background: '#f8b700',
                  padding: '1px 5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {id}
              </span>
            </div>
          ))}
      </div>

      {showDebug && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            font: '500 16px ui-monospace, monospace',
            color: '#f8b700',
            background: 'rgba(0, 0, 0, 0.72)',
            padding: '8px 12px',
            lineHeight: 1.5,
            whiteSpace: 'pre',
          }}
        >
          {[
            `frame ${frame}  ${(frame / fps).toFixed(2)}s`,
            `stop  ${index < 0 ? '— (opening)' : `#${index} ${JSON.stringify(active?.stop.to ?? 'centre')}`}`,
            `cam   x ${camera.x.toFixed(3)}  y ${camera.y.toFixed(3)}  ${camera.scale.toFixed(2)}x`,
            `box   ${box.width} x ${Math.round(box.height)} css px`,
            `named ${Object.keys(targets).join(' ') || '—'}`,
          ].join('\n')}
        </div>
      )}
    </AbsoluteFill>
  )
}
