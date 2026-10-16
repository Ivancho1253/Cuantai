import { ImageResponse } from 'next/og';
export const alt = 'Cuantai — El mercado, en perspectiva';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#0b0e11',
        color: '#e9eceb',
        padding: '65px 75px',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 40,
          letterSpacing: -2,
          fontWeight: 700,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 36 }}>
          {[17, 27, 36].map((height) => (
            <div
              key={height}
              style={{ width: 8, height, borderRadius: 3, background: '#c8ef84' }}
            />
          ))}
        </div>
        cuantai<span style={{ color: '#c8ef84', marginLeft: -15 }}>.</span>
      </div>
      <div
        style={{ display: 'flex', fontSize: 15, letterSpacing: 4, color: '#8b968a', marginTop: 65 }}
      >
        FINANCIAL INTELLIGENCE
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 72,
          letterSpacing: -3,
          lineHeight: 1.15,
          marginTop: 20,
        }}
      >
        Leé el mercado.
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 72,
          letterSpacing: -3,
          lineHeight: 1.15,
          color: '#c8ef84',
        }}
      >
        Encontrá tu perspectiva.
      </div>
      <div style={{ display: 'flex', fontSize: 22, color: '#889198', marginTop: 34 }}>
        Gráficos · Inteligencia · Portfolio
      </div>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          bottom: 37,
          left: 75,
          right: 75,
          borderTop: '1px solid #242a2f',
          paddingTop: 21,
          fontSize: 14,
          color: '#65706e',
          justifyContent: 'space-between',
        }}
      >
        <span>Todos tus mercados. Una visión completa.</span>
        <span>CUANTAI</span>
      </div>
    </div>,
    size,
  );
}
