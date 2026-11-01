import { Box, Button, Card, CardContent, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';

import { goalsApi } from '../../api/goals';
import { clampProgress, formatGoalValue, goalStatus } from '../goals/goalUtils';
import { DashboardEmptyState } from './DashboardEmptyState';
import { fontSizes } from '../../theme/fontSizes';

const MAX_GOALS = 3;

interface GoalsCardProps {
  /** Data (YYYY-MM-DD) usada para escolher as metas cujo período a contém. */
  at: string;
}

/** Card "Metas do mês" do dashboard, com as primeiras metas do período. */
export function GoalsCard({ at }: GoalsCardProps) {
  const theme = useTheme();
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', 'at', at],
    queryFn: () => goalsApi.list({ at }),
    placeholderData: keepPreviousData,
  });
  const visible = goals.slice(0, MAX_GOALS);

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.75 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>Metas do mês</Typography>
          <Button size="small" component={RouterLink} to="/metas" sx={{ fontWeight: 700 }}>
            {goals.length > MAX_GOALS ? `Ver todas (${goals.length})` : 'Ver metas'}
          </Button>
        </Stack>
        {isLoading ? (
          <Stack spacing={2}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </Stack>
        ) : visible.length === 0 ? (
          <DashboardEmptyState message="Nenhuma meta definida para este período" />
        ) : (
          <Stack spacing={2}>
            {visible.map((g) => {
              const tone = goalStatus(g.progress).tone(theme, g.color);
              return (
                <Box key={g.id}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                    <Typography noWrap sx={{ fontSize: fontSizes.sm, fontWeight: 600, minWidth: 0 }}>
                      {g.name}
                    </Typography>
                    <Typography sx={{ fontSize: fontSizes.sm, fontWeight: 800, color: tone, flexShrink: 0 }}>
                      {Math.round(g.progress)}%
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 8, borderRadius: 8, bgcolor: 'grey.100', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${clampProgress(g.progress)}%`, borderRadius: 8, bgcolor: g.color }} />
                  </Box>
                  <Typography sx={{ display: 'block', fontSize: fontSizes.xs, color: 'text.secondary', mt: 0.75 }}>
                    {formatGoalValue(g.currentValue, g.format)} de {formatGoalValue(g.target, g.format)}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
