import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'

export const runtime = 'nodejs'
export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

/**
 * The favicon, from the same path as the wordmark rather than a separate file
 * that drifts. The mark was drawn to hold at 20px precisely so this works.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#170e09',
      }}
    >
      <BrandMark size={54} color="#f8b700" />
    </div>,
    size,
  )
}
