/**
 * `next/navigation`, for a renderer that has no router.
 *
 * Only the client components reach for this (the search box, the compare
 * picker, the nav). Nothing in the video interacts with them, so every hook
 * here returns the inert value its caller treats as "nothing happened yet".
 * If a future shot needs one of those components to actually do something,
 * that shot should drive it by props, not by faking a router harder.
 */
const noop = () => undefined

export const useRouter = () => ({
  push: noop,
  replace: noop,
  refresh: noop,
  back: noop,
  forward: noop,
  prefetch: noop,
})

export const usePathname = () => '/'
export const useSearchParams = () => new URLSearchParams()
export const useParams = () => ({}) as Record<string, string>
export const redirect = noop
export const notFound = noop
