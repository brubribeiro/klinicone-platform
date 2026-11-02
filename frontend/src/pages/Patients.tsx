import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Card, Skeleton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import 'dayjs/locale/pt-br';

import { patientsApi } from '../api/patients';
import { PatientFormDialog } from '../components/patients/PatientFormDialog';
import { AnamnesisFormDialog } from '../components/patients/AnamnesisFormDialog';
import { PatientDetailDrawer } from '../components/patients/PatientDetailDrawer';
import {
  PatientListColumns,
  type PatientSort,
  type PatientSortKey,
} from '../components/patients/PatientListColumns';
import { PatientListEmptyState } from '../components/patients/PatientListEmptyState';
import { PatientListPagination } from '../components/patients/PatientListPagination';
import { PatientListRow } from '../components/patients/PatientListRow';
import { StatCard } from '../components/StatCard';
import { SendWhatsAppDialog } from '../components/messages/SendWhatsAppDialog';
import {
  LIST_HEADER_ACTION_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import { useUrlState, urlPage, type UrlCodec } from '../hooks/useUrlState';
import type { Patient } from '../types';
import { fontSizes } from '../theme/fontSizes';
import { moneyFormatter } from '../utils/money';

const PAGE_SIZE = 8;

const PATIENT_SORT_KEYS: PatientSortKey[] = ['lastVisit', 'totalSpent', 'appointments'];

// ?ordem=-lastVisit (desc) | ?ordem=lastVisit (asc)
const PATIENT_SORT_CODEC: UrlCodec<PatientSort> = {
  parse: (raw) => {
    const key = raw.replace(/^-/, '') as PatientSortKey;
    if (!PATIENT_SORT_KEYS.includes(key)) return undefined;
    return { key, dir: raw.startsWith('-') ? 'desc' : 'asc' };
  },
  serialize: (value) => (value ? `${value.dir === 'desc' ? '-' : ''}${value.key}` : ''),
};

const brl = moneyFormatter({ maximumFractionDigits: 0 });

export function Patients() {
  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('patients:create');
  const canEdit = has('patients:edit');
  const canDelete = has('patients:delete');

  const [search, setSearch] = useUrlState('busca', '');
  const [page, setPage] = useUrlState('pagina', 0, urlPage);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Reabre o drawer da ficha ao voltar da página estendida (?ficha=<id>)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const ficha = searchParams.get('ficha');
    if (ficha) {
      setDetailId(ficha);
      const next = new URLSearchParams(searchParams);
      next.delete('ficha');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [sort, setSort] = useUrlState<PatientSort>('ordem', null, PATIENT_SORT_CODEC);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [anamnesisPatientId, setAnamnesisPatientId] = useState<string | null>(null);
  const [whatsappPatient, setWhatsappPatient] = useState<Patient | null>(null);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: () => patientsApi.list(search || undefined),
    placeholderData: keepPreviousData,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['patients-stats'],
    queryFn: () => patientsApi.stats(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients-stats'] });
      toast.success('Paciente excluído.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o paciente.'));
    },
  });

  const sortedPatients = useMemo(() => {
    if (!sort) return patients;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...patients].sort((a, b) => {
      if (sort.key === 'lastVisit') {
        const av = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
        const bv = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
        return (av - bv) * dir;
      }
      if (sort.key === 'appointments') {
        return ((a.appointmentsCount ?? 0) - (b.appointmentsCount ?? 0)) * dir;
      }
      return ((a.totalSpent ?? 0) - (b.totalSpent ?? 0)) * dir;
    });
  }, [patients, sort]);

  const toggleSort = (key: PatientSortKey) => {
    setPage(0);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return null;
    });
  };

  const pageCount = Math.max(1, Math.ceil(sortedPatients.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => sortedPatients.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [sortedPatients, currentPage],
  );

  const rangeStart = sortedPatients.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, sortedPatients.length);


  const handleDelete = async (patient: Patient) => {
    const ok = await confirm({
      title: 'Excluir paciente',
      message: `Excluir paciente ${patient.name}?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(patient.id);
  };

  return (
    <Box>
      {/* Cards de estatística */}
      <Box
        data-tour="patients-stats"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: { xs: 1.5, sm: 2 },
          mb: { xs: 2, sm: 2.5 },
        }}
      >
        <StatCard label="Total de pacientes" value={String(stats?.total ?? 0)} loading={statsLoading} />
        <StatCard label="Ativos (90 dias)" value={String(stats?.active90 ?? 0)} loading={statsLoading} />
        <StatCard label="Novos no mês" value={String(stats?.newThisMonth ?? 0)} loading={statsLoading} />
        <StatCard label="Ticket médio" value={brl.format(stats?.averageTicket ?? 0)} loading={statsLoading} />
      </Box>

      {/* Tabela */}
      <Card data-tour="patients-list" sx={{ p: 0, overflow: 'hidden' }}>
        {/* Cabeçalho da tabela */}
        <ListCardHeader title={<Typography sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>Todos os pacientes</Typography>}>
          <ListSearchField value={searchInput} onChange={setSearchInput} placeholder="Buscar paciente, CPF..." ariaLabel="Buscar paciente por nome, CPF ou telefone" />
          {canCreate && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              data-tour="patients-new"
              sx={LIST_HEADER_ACTION_SX}
            >
              Adicionar paciente
            </Button>
          )}
        </ListCardHeader>

        {/* Cabeçalho de colunas */}
        <PatientListColumns sort={sort} onToggleSort={toggleSort} />

        {/* Linhas */}
        {isLoading ? (
          <Box sx={{ px: 2.75, py: 2 }}>
            <Stack spacing={1.25}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={52} />
              ))}
            </Stack>
          </Box>
        ) : patients.length === 0 ? (
          <PatientListEmptyState
            search={search}
            canCreate={canCreate}
            onCreate={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
        ) : (
          pageRows.map((p) => (
            <PatientListRow
              key={p.id}
              patient={p}
              canEdit={canEdit}
              canDelete={canDelete}
              onOpen={() => setDetailId(p.id)}
              onWhatsApp={() => setWhatsappPatient(p)}
              onAnamnesis={() => setAnamnesisPatientId(p.id)}
              onEdit={() => {
                setEditing(p);
                setFormOpen(true);
              }}
              onDelete={() => handleDelete(p)}
            />
          ))
        )}

        {/* Paginação */}
        {!isLoading && patients.length > 0 && (
          <PatientListPagination
            pageCount={pageCount}
            currentPage={currentPage}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={patients.length}
            setPage={setPage}
          />
        )}
      </Card>

      <PatientFormDialog open={formOpen} onClose={() => setFormOpen(false)} patient={editing} />
      <PatientDetailDrawer
        patientId={detailId}
        onClose={() => setDetailId(null)}
        onEditAnamnesis={canEdit ? setAnamnesisPatientId : undefined}
      />
      <AnamnesisFormDialog
        open={!!anamnesisPatientId}
        patientId={anamnesisPatientId}
        onClose={() => setAnamnesisPatientId(null)}
      />
      <SendWhatsAppDialog
        open={!!whatsappPatient}
        onClose={() => setWhatsappPatient(null)}
        phone={whatsappPatient?.phone}
        patientId={whatsappPatient?.id}
        vars={{ paciente_nome: whatsappPatient?.name?.split(' ')[0] }}
        title={`Enviar mensagem para ${whatsappPatient?.name ?? ''}`}
      />
    </Box>
  );
}
