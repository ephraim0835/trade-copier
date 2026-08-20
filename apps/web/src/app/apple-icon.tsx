import { ImageResponse } from 'next/og';
 
export const runtime = 'edge';
 
export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';
 
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
        }}
      >
        <div style={{ display: 'flex', width: '90px', height: '102px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '45px', height: '102px', background: '#3b82f6' }} />
          <div style={{ position: 'absolute', left: '45px', top: 0, width: '45px', height: '67.5px', background: '#10b981' }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
