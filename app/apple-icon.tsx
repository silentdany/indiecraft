import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'

export const runtime = 'nodejs'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Same mark, the size iOS asks for. */
export default function AppleIcon() {
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
      <BrandMark size={140} color="#f8b700" />
    </div>,
    size,
  )
}
