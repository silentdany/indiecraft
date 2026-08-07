import type { CSSProperties, ReactNode } from 'react'

/**
 * The double gold frame with corner brackets. Together with the Roman serif,
 * this is half the product's visual recognition — and it owes Blizzard nothing.
 */
export function Frame({
  children,
  style,
  className = '',
}: {
  children: ReactNode
  style?: CSSProperties
  className?: string
}) {
  return (
    <div className={`frame ${className}`} style={style}>
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />
      {children}
    </div>
  )
}
