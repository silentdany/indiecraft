'use client'

import posthog from 'posthog-js'
import { type ReactNode, useEffect } from 'react'

/**
 * PostHog from day one, and stateless on the device.
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
      /*
       * Nothing on the visitor's device, so nothing to ask consent for.
       *
       * 'memory' keeps the anonymous id and the session in the page and drops
       * them on the next load: no cookie, no localStorage, no sessionStorage.
       * The metric this exists for, sheet views by referrer, needs none of
       * them. What it costs is cross-visit counting, which nobody here reads.
       *
       * The rest keeps PostHog to the events we send: no recordings, no
       * surveys or experiments, and no extra scripts pulled from its CDN,
       * which is also what lets the CSP name one PostHog host.
       */
      persistence: 'memory',
      disable_session_recording: true,
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      disable_web_experiments: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
    })
  }, [])

  return <>{children}</>
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}
