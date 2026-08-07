'use client'

import posthog from 'posthog-js'
import { type ReactNode, useEffect } from 'react'

/**
 * PostHog from day one.
 *
 * Sharing is the only metric that matters. The question the dashboard has to
 * answer: how many character sheet views come from a referrer on X that isn't
 * us.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      capture_pageview: true,
      person_profiles: 'never',
    })
  }, [])

  return <>{children}</>
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}
