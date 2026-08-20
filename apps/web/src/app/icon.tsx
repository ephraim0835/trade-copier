import { ImageResponse } from 'next/og';
 
// Route segment config
export const runtime = 'edge';
 
// Image metadata
export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';
 
// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          borderRadius: '112px',
        }}
      >
        <div style={{ display: 'flex', width: '240px', height: '272px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '120px', height: '272px', background: '#3b82f6' }} />
          <div style={{ position: 'absolute', left: '120px', top: 0, width: '120px', height: '180px', background: '#10b981' }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
