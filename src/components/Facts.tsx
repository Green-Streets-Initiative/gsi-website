/**
 * Short facts joined with " · ", each kept whole when the line wraps, so
 * "4.1 mi ride" never breaks into "4.1 mi / ride". Empty parts drop out.
 */
export default function Facts({ parts }: { parts: Array<string | null | undefined | false> }) {
  const shown = parts.filter((p): p is string => !!p)
  return (
    <>
      {shown.map((p, i) => {
        const last = i === shown.length - 1
        // The dot stays at the end of the line; the next fact starts the next one.
        return (
          <span key={i}>
            <span className="whitespace-nowrap">{p}{!last && ' ·'}</span>
            {!last && ' '}
          </span>
        )
      })}
    </>
  )
}
