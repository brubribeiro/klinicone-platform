import { useEffect, useRef } from 'react';
import { Box, useMediaQuery } from '@mui/material';

/**
 * Clipe curto do painel em uma moldura de janela. Só baixa e toca quando entra na tela
 * (`preload="none"` + IntersectionObserver) e pausa ao sair. Com movimento reduzido, não toca
 * sozinho: fica o poster e os controles do navegador.
 */
export function LandingVideo({ name, label }: { name: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    const video = ref.current;
    if (!video || reduceMotion) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [reduceMotion]);

  return (
    <Box
      sx={{
        borderRadius: '16px',
        overflow: 'hidden',
        bgcolor: '#0E2926',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 24px 60px -28px rgba(14,41,38,.55)',
      }}
    >
      <Box aria-hidden="true" sx={{ display: 'flex', gap: '6px', px: 1.5, py: 1 }}>
        {['#E0726B', '#E3B341', '#5FB37A'].map((c) => (
          <Box key={c} sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: c, opacity: 0.85 }} />
        ))}
      </Box>
      <Box
        component="video"
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        controls={reduceMotion}
        poster={`/videos/${name}.jpg`}
        aria-label={label}
        sx={{ display: 'block', width: '100%', aspectRatio: '1440 / 746', objectFit: 'cover', bgcolor: '#fff' }}
      >
        <source src={`/videos/${name}.mp4`} type="video/mp4" />
      </Box>
    </Box>
  );
}
