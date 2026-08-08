/**
 * Structured data.
 *
 * `dangerouslySetInnerHTML` is the documented way to emit JSON-LD in React, and
 * everything passed in here is built server-side from our own database rather
 * than from anything a visitor can influence. The `<` escape closes the one
 * real hole: a value containing `</script>` would otherwise end the tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the only supported way to emit JSON-LD.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
