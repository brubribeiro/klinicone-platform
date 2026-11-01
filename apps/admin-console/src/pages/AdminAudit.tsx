import { Box, Button, Card, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { adminApi } from '../api/admin';
import { useUrlState, urlPage } from '../../../../frontend/src/hooks/useUrlState';
import { LIST_HEADER_SELECT_SX, ListCardHeader } from '../../../../frontend/src/components/ListCardHeader';
import { PlatformAuditList } from '../components/PlatformAuditList';
import { fontSizes } from '../../../../frontend/src/theme/fontSizes';

const PAGE_SIZE = 25;

/** Auditoria das ações do super-admin (criar, editar, suspender, reativar, entrar como). */
export function AdminAudit() {
  const [tenantId, setTenantId] = useUrlState('clinica', '');
  const [page, setPage] = useUrlState('pagina', 0, urlPage);

  const { data: tenants = [] } = useQuery({
    queryKey: ['admin', 'tenants', { search: '', status: 'ALL' }],
    queryFn: () => adminApi.listTenants(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', { tenantId, page }],
    queryFn: () => adminApi.listAudit({ tenantId: tenantId || undefined, page: page + 1, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const totalPages = data?.totalPages ?? 1;

  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      <ListCardHeader
        title={
          <Typography sx={{ fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 600 }}>
            {isLoading ? (
              <Skeleton width={180} />
            ) : (
              <>
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                  {data?.total ?? 0}
                </Box>{' '}
                {data?.total === 1 ? 'ação registrada' : 'ações registradas'}
              </>
            )}
          </Typography>
        }
      >
        <TextField
          select
          size="small"
          value={tenantId}
          onChange={(e) => {
            setTenantId(e.target.value);
            setPage(0);
          }}
          inputProps={{ 'aria-label': 'Clínica' }}
          SelectProps={{ displayEmpty: true }}
          sx={{ ...LIST_HEADER_SELECT_SX, minWidth: { sm: 220 } }}
        >
          <MenuItem value="">Todas as clínicas</MenuItem>
          {tenants.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name}
            </MenuItem>
          ))}
        </TextField>
      </ListCardHeader>

      <PlatformAuditList entries={data?.data ?? []} loading={isLoading} showTenant />

      {totalPages > 1 && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}
        >
          <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
            Página {page + 1} de {totalPages}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <Button size="small" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
              Próxima
            </Button>
          </Stack>
        </Stack>
      )}
    </Card>
  );
}
