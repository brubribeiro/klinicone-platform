import { Box, Chip, Stack, Typography } from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import BlockIcon from '@mui/icons-material/Block';
import type { DeletionDependency } from '../utils/deletionConflict';

function DependencyRow({ dep }: { dep: DeletionDependency }) {
  const extra = dep.count - dep.names.length;
  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        p: 1.25,
        border: 1,
        borderColor: dep.unlinkable ? 'divider' : 'error.light',
        borderRadius: 1.5,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}>
          {dep.unlinkable ? (
            <LinkOffIcon fontSize="small" color="action" />
          ) : (
            <BlockIcon fontSize="small" color="error" />
          )}
          <Typography variant="body2" fontWeight={600} noWrap>
            {dep.label}
          </Typography>
        </Stack>
        <Chip
          size="small"
          label={dep.count}
          color={dep.unlinkable ? 'default' : 'error'}
          variant="outlined"
        />
      </Stack>
      {dep.names.length > 0 && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {dep.names.join(', ')}
          {extra > 0 ? ` e mais ${extra}` : ''}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
        {dep.note}
      </Typography>
    </Box>
  );
}

/** Lista o que está atrelado ao registro: primeiro o que bloqueia, depois o que será desvinculado. */
export function DeletionDependenciesList({ dependencies }: { dependencies: DeletionDependency[] }) {
  const blocking = dependencies.filter((d) => !d.unlinkable);
  const unlinkable = dependencies.filter((d) => d.unlinkable);
  return (
    <Stack spacing={1.5} sx={{ mt: 1.5 }} data-testid="deletion-dependencies">
      {blocking.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75 }}>
            Impede a exclusão
          </Typography>
          <Stack component="ul" spacing={0.75} sx={{ m: 0, p: 0 }}>
            {blocking.map((d) => (
              <DependencyRow key={d.type} dep={d} />
            ))}
          </Stack>
        </Box>
      )}
      {unlinkable.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75 }}>
            {blocking.length > 0 ? 'Também atrelado' : 'Será desvinculado'}
          </Typography>
          <Stack component="ul" spacing={0.75} sx={{ m: 0, p: 0 }}>
            {unlinkable.map((d) => (
              <DependencyRow key={d.type} dep={d} />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
