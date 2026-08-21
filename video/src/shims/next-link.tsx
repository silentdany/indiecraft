import type { AnchorHTMLAttributes, ReactNode } from 'react'

/**
 * `next/link`, for a renderer that has no router.
 *
 * The sheet components are shot as-is rather than copied into this project,
 * which is the whole point of rendering React instead of a screen capture —
 * the video cannot drift from the site. The only thing they need from Next is
 * Link, and in a video nothing is ever clicked, so an anchor is the entire
 * behaviour. The Next-only props are swallowed here so they never reach the
 * DOM and trip React's unknown-attribute warning.
 */
type NextOnlyProps = {
  href: string | { pathname?: string }
  prefetch?: boolean | null | 'auto'
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  locale?: string | false
  as?: string
  onNavigate?: unknown
  transitionTypes?: unknown
  children?: ReactNode
}

type Props = NextOnlyProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof NextOnlyProps | 'href'>

export default function Link({
  href,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  locale: _locale,
  as: _as,
  onNavigate: _onNavigate,
  transitionTypes: _transitionTypes,
  children,
  ...rest
}: Props) {
  const resolved = typeof href === 'string' ? href : (href.pathname ?? '#')
  return (
    <a href={resolved} {...rest}>
      {children}
    </a>
  )
}
