/**
 * Renders a JSON-LD structured-data block. Pass a single schema object or an
 * array of them. Server or client component — it emits a plain <script> tag.
 *
 * Generalizes the inline pattern that town/roam pages already used.
 */
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[]
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
