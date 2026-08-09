import { clearSession, siteOrigin } from '@/lib/auth'

export const runtime = 'nodejs'

/** POST, because signing out changes state and must not happen on a prefetch. */
export async function POST(request: Request) {
  await clearSession()
  const next = new URL(request.url).searchParams.get('next')
  return Response.redirect(`${siteOrigin()}${next?.startsWith('/') ? next : '/'}`, 303)
}
