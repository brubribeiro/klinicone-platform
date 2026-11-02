import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { alpha, Box, Button, IconButton, Modal, Paper, Popper, Stack, Typography, useTheme } from '@mui/material';

import { AuroraIcon } from '../AuroraIcon';
import { fontSizes } from '../../theme/fontSizes';

export interface TourStep {
  /** Valor do `data-tour` do elemento destacado; sem ele o passo aparece centralizado. */
  target?: string;
  title: string;
  body: string;
}

interface GuidedTourProps {
  steps: TourStep[];
  /** Chamado ao concluir ou dispensar (Esc, “Pular”, fechar). */
  onClose: () => void;
}

const SPOTLIGHT_PADDING = 6;
// Altura do header fixo + folga: o elemento destacado não fica escondido atrás dele.
const HEADER_OFFSET = 96;

function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  // Escondido por breakpoint (display: none) ou sem layout: o passo é pulado.
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? el : null;
}

/** Montar o componente abre o tour; os passos visíveis são definidos nesse momento. */
export function GuidedTour({ steps, onClose }: GuidedTourProps) {
  const theme = useTheme();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  // Só os passos cujo elemento está na tela: respeita permissões e dados da página.
  const [activeSteps] = useState(() => steps.filter((s) => !s.target || findTarget(s.target)));
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Ao fechar, devolve a página à posição de rolagem de antes do tour.
  useEffect(() => {
    const scrollY = window.scrollY;
    return () => window.scrollTo({ top: scrollY });
  }, []);

  const step = activeSteps[index];

  useLayoutEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < HEADER_OFFSET || r.bottom > window.innerHeight - 12) {
        window.scrollBy({ top: r.top - HEADER_OFFSET });
      }
    }
    setAnchor(el);
    setRect(el?.getBoundingClientRect() ?? null);
    cardRef.current?.focus();
  }, [step]);

  // Mantém o recorte alinhado ao elemento ao rolar ou redimensionar a janela.
  useEffect(() => {
    if (!anchor) return;
    const update = () => setRect(anchor.getBoundingClientRect());
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor]);

  if (!step) return null;

  const isLast = index === activeSteps.length - 1;
  const next = () => (isLast ? onClose() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
  };

  const overlay = alpha('#0B1F1C', theme.palette.mode === 'dark' ? 0.7 : 0.55);

  const card = (
    <Paper
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={handleKeyDown}
      elevation={0}
      sx={{
        width: 'min(360px, calc(100vw - 24px))',
        p: { xs: 2, sm: 2.5 },
        borderRadius: '18px',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 18px 48px -12px rgba(11,31,28,.45)',
        outline: 'none',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: fontSizes.xs, fontWeight: 700, color: 'primary.main', letterSpacing: '0.4px' }}>
          {index + 1} DE {activeSteps.length}
        </Typography>
        <IconButton size="small" aria-label="Fechar tour" onClick={onClose} sx={{ mr: -0.75, color: 'text.secondary' }}>
          <AuroraIcon name="close" size={18} strokeWidth={2} />
        </IconButton>
      </Stack>
      <Typography id={titleId} component="h2" sx={{ fontSize: fontSizes.lg, fontWeight: 800, letterSpacing: '-0.3px', mb: 0.75 }}>
        {step.title}
      </Typography>
      <Typography id={bodyId} aria-live="polite" sx={{ fontSize: fontSizes.md, color: 'text.secondary', lineHeight: 1.5 }}>
        {step.body}
      </Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: 2.25 }}>
        <Box sx={{ display: 'flex', gap: 0.6 }} aria-hidden>
          {activeSteps.map((s, i) => (
            <Box
              key={`${s.title}-${i}`}
              sx={{
                width: i === index ? 16 : 6,
                height: 6,
                borderRadius: 3,
                bgcolor: i === index ? 'primary.main' : 'divider',
                transition: 'width .2s',
              }}
            />
          ))}
        </Box>
        <Stack direction="row" spacing={1}>
          {index === 0 ? (
            <Button variant="text" onClick={onClose} sx={{ fontWeight: 700, color: 'text.secondary' }}>
              Pular
            </Button>
          ) : (
            <Button variant="text" onClick={back} sx={{ fontWeight: 700 }}>
              Voltar
            </Button>
          )}
          <Button variant="contained" onClick={next} sx={{ fontWeight: 700, borderRadius: '10px', px: 2 }}>
            {isLast ? 'Concluir' : 'Próximo'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );

  return (
    <Modal open onClose={onClose} hideBackdrop disableScrollLock>
      <Box sx={{ position: 'fixed', inset: 0, outline: 'none' }}>
        {rect ? (
          // Recorte: a sombra gigante escurece tudo ao redor do elemento destacado.
          <Box
            aria-hidden
            sx={{
              position: 'fixed',
              top: rect.top - SPOTLIGHT_PADDING,
              left: rect.left - SPOTLIGHT_PADDING,
              width: rect.width + SPOTLIGHT_PADDING * 2,
              height: rect.height + SPOTLIGHT_PADDING * 2,
              borderRadius: '14px',
              boxShadow: `0 0 0 9999px ${overlay}`,
              outline: `2px solid ${theme.palette.primary.main}`,
              pointerEvents: 'none',
              transition: 'top .2s, left .2s, width .2s, height .2s',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          />
        ) : (
          <Box aria-hidden sx={{ position: 'fixed', inset: 0, bgcolor: overlay }} />
        )}
        {anchor ? (
          <Popper
            open
            anchorEl={anchor}
            placement="bottom"
            disablePortal
            popperOptions={{ strategy: 'fixed' }}
            modifiers={[
              { name: 'offset', options: { offset: [0, SPOTLIGHT_PADDING + 10] } },
              { name: 'preventOverflow', options: { padding: 12, altAxis: true } },
              { name: 'flip', options: { padding: 12, fallbackPlacements: ['top', 'left', 'right'] } },
            ]}
            sx={{ zIndex: 1 }}
          >
            {card}
          </Popper>
        ) : (
          <Box sx={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1.5 }}>
            {card}
          </Box>
        )}
      </Box>
    </Modal>
  );
}
