import { useMemo, useRef, useState } from 'react';
import { Box, Button, Card, IconButton, MenuItem, Skeleton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DocumentActionsMenu } from '../components/documents/DocumentActionsMenu';
import { DocumentFormDialog, MAX_FILE_BYTES, UPLOAD_ACCEPT } from '../components/documents/DocumentFormDialog';
import {
  DOCUMENT_GRID_COLS,
  DOCUMENT_GRID_MIN_WIDTH,
  DocumentListRow,
} from '../components/documents/DocumentListRow';
import { DocumentTemplatesDialog } from '../components/documents/DocumentTemplatesDialog';
import { DocumentViewerDialog } from '../components/documents/DocumentViewerDialog';
import { SendDocumentDialog } from '../components/documents/SendDocumentDialog';
import {
  DOCUMENT_STATUSES,
  canOpenDocument,
  categoryMeta,
  fmtFileSize,
  fmtStorageTotal,
  statusMeta,
  sumDocumentBytes,
} from '../components/documents/documentUtils';
import { usePlatformCatalog } from '../hooks/usePlatformCatalog';
import {
  LIST_HEADER_ICON_BUTTON_SX,
  LIST_HEADER_PRIMARY_ACTION_SX,
  LIST_HEADER_SELECT_SX,
  ListCardHeader,
  ListSearchField,
} from '../components/ListCardHeader';
import { ListPageButtons } from '../components/ListPageButtons';
import { ListEmptyState } from '../components/ListStates';
import { ListTableHeader } from '../components/ListTableHeader';
import { StatCard } from '../components/StatCard';
import { usePagination } from '../hooks/usePagination';
import { documentsApi } from '../api/documents';
import { documentTemplatesApi } from '../api/documentTemplates';
import { useAppDialog } from '../contexts/AppDialogContext';
import { useAppToast } from '../contexts/AppToastContext';
import { getApiErrorMessage } from '../utils/apiError';
import { usePermissions } from '../contexts/usePermissions';
import { useUrlState, urlEnum } from '../hooks/useUrlState';
import { matchFields } from '../utils/listFilters';
import type { DocumentFile, DocumentStatus } from '../types';
import { fontSizes } from '../theme/fontSizes';

type LinkFilter = 'ALL' | 'PATIENT' | 'EQUIPMENT' | 'NONE';

const DOCS_KEY = ['documents'];
const PAGE_SIZE = 8;

const TOOLBAR_SELECT_SX = { ...LIST_HEADER_SELECT_SX, width: { xs: 'calc(50% - 5px)', sm: 160 } } as const;

function replaceDocument(list: DocumentFile[] | undefined, doc: DocumentFile): DocumentFile[] {
  const prev = list ?? [];
  if (!prev.some((d) => d.id === doc.id)) return [doc, ...prev];
  return prev.map((d) => (d.id === doc.id ? { ...d, ...doc } : d));
}


const STATUS_FILTER_CODEC = urlEnum<'ALL' | DocumentStatus>(['ALL', 'PENDING', 'SENT', 'SIGNED']);
const LINK_FILTER_CODEC = urlEnum<LinkFilter>(['ALL', 'PATIENT', 'EQUIPMENT', 'NONE']);

export function Documents() {
  const queryClient = useQueryClient();
  const { confirm, alert } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canCreate = has('documents:create');
  const canEdit = has('documents:edit');
  const canDelete = has('documents:delete');
  const documentCategories = usePlatformCatalog('document_category');

  const [search, setSearch] = useUrlState('busca', '');
  const [statusFilter, setStatusFilter] = useUrlState<'ALL' | DocumentStatus>('status', 'ALL', STATUS_FILTER_CODEC);
  const [categoryFilter, setCategoryFilter] = useUrlState('categoria', 'ALL');
  const [linkFilter, setLinkFilter] = useUrlState<LinkFilter>('vinculo', 'ALL', LINK_FILTER_CODEC);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentFile | null>(null);
  const [viewing, setViewing] = useState<DocumentFile | null>(null);
  const [sending, setSending] = useState<DocumentFile | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; doc: DocumentFile } | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<DocumentFile | null>(null);

  const { data: docs = [], isLoading, isFetching } = useQuery({
    queryKey: DOCS_KEY,
    queryFn: () => documentsApi.list(),
  });
  const loading = isLoading || (isFetching && docs.length === 0);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['document-templates'],
    queryFn: documentTemplatesApi.list,
  });

  const handleSaved = (saved: DocumentFile, created: boolean) => {
    queryClient.setQueryData<DocumentFile[]>(DOCS_KEY, (old) => replaceDocument(old, saved));
    void queryClient.invalidateQueries({ queryKey: [...DOCS_KEY, saved.id], exact: true });
    if (created) {
      setStatusFilter('ALL');
      setCategoryFilter('ALL');
      setLinkFilter('ALL');
      setSearch('');
      setPage(0);
      if (saved.templateId) void queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      // Documento gerado de modelo: abre o texto para conferir e imprimir
      if (saved.hasContent && !saved.storageKey) setViewing(saved);
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DocumentStatus }) => documentsApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: DOCS_KEY, exact: true });
      const previous = queryClient.getQueryData<DocumentFile[]>(DOCS_KEY);
      queryClient.setQueryData<DocumentFile[]>(DOCS_KEY, (old = []) =>
        old.map((d) => (d.id === id ? { ...d, status } : d)),
      );
      return { previous };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<DocumentFile[]>(DOCS_KEY, (old) => replaceDocument(old, saved));
      toast.success(`Documento marcado como ${statusMeta(saved.status).label.toLowerCase()}.`);
    },
    onError: (err, _vars, ctx) => {
      queryClient.setQueryData(DOCS_KEY, ctx?.previous);
      toast.error(getApiErrorMessage(err, 'Não foi possível alterar o status.'));
    },
  });

  const attachMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => documentsApi.attachFile(id, file),
    onSuccess: (saved) => {
      handleSaved(saved, false);
      setViewing((v) => (v?.id === saved.id ? saved : v));
      toast.success('Versão assinada anexada.');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Não foi possível anexar o arquivo.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: (_res, id) => {
      queryClient.setQueryData<DocumentFile[]>(DOCS_KEY, (old = []) => old.filter((d) => d.id !== id));
      void queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast.success('Documento excluído.');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o documento.'));
    },
  });

  const stats = useMemo(() => {
    let patients = 0;
    let equipment = 0;
    let unlinked = 0;
    const byCategory: Record<string, number> = {};
    const byStatus: Record<DocumentStatus, number> = { PENDING: 0, SENT: 0, SIGNED: 0 };

    for (const d of docs) {
      if (d.patientId) patients += 1;
      else if (d.equipmentId) equipment += 1;
      else unlinked += 1;

      const key = d.category || '__none__';
      byCategory[key] = (byCategory[key] ?? 0) + 1;
      byStatus[d.status] += 1;
    }

    return {
      total: docs.length,
      patients,
      equipment,
      unlinked,
      byCategory,
      byStatus,
      totalBytes: sumDocumentBytes(docs),
    };
  }, [docs]);

  const activeTemplates = templates.filter((t) => t.active).length;

  const filteredDocs = useMemo(
    () =>
      docs.filter((d) => {
        if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
        if (categoryFilter !== 'ALL') {
          if (categoryFilter === '__none__' && d.category) return false;
          if (categoryFilter !== '__none__' && (d.category ?? '') !== categoryFilter) return false;
        }
        if (linkFilter === 'PATIENT' && !d.patientId) return false;
        if (linkFilter === 'EQUIPMENT' && !d.equipmentId) return false;
        if (linkFilter === 'NONE' && (d.patientId || d.equipmentId)) return false;
        return matchFields(
          search,
          d.name,
          categoryMeta(d.category).label,
          d.patient?.name,
          d.equipment?.name,
          d.notes,
          d.template?.name,
        );
      }),
    [docs, search, statusFilter, categoryFilter, linkFilter],
  );

  const { page: current, setPage, pageCount, rows, rangeStart, rangeEnd } = usePagination(
    filteredDocs,
    PAGE_SIZE,
  );

  const handleDelete = async (doc: DocumentFile) => {
    const ok = await confirm({
      title: 'Excluir documento',
      message: `Excluir ${doc.name}?`,
      confirmLabel: 'Excluir',
      confirmColor: 'error',
    });
    if (ok) deleteMutation.mutate(doc.id);
  };

  const handleOpenDocument = async (doc: DocumentFile) => {
    try {
      const url = await documentsApi.getAccessUrl(doc.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      await alert({
        title: 'Não foi possível abrir',
        message: 'Não foi possível gerar o link de acesso ao documento. Tente novamente.',
      });
    }
  };

  const handleRowClick = (doc: DocumentFile) => {
    if (canOpenDocument(doc)) void handleOpenDocument(doc);
    else if (doc.hasContent) setViewing(doc);
    else if (canEdit) {
      setEditing(doc);
      setFormOpen(true);
    }
  };

  const startAttach = (doc: DocumentFile) => {
    attachTarget.current = doc;
    attachInputRef.current?.click();
  };

  const handleAttachSelected = (file: File | undefined) => {
    const doc = attachTarget.current;
    attachTarget.current = null;
    if (!file || !doc) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`O arquivo tem ${fmtFileSize(file.size)}; o limite é 25 MB.`);
      return;
    }
    attachMutation.mutate({ id: doc.id, file });
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };


  return (
    <Stack spacing={2.25}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 1.5, sm: 2.25 },
        }}
      >
        <StatCard label="Total de documentos" value={stats.total} loading={loading} />
        <StatCard label="Assinados" value={stats.byStatus.SIGNED} loading={loading} />
        <StatCard label="Pendentes" value={stats.byStatus.PENDING} loading={loading} />
        <StatCard label="Modelos ativos" value={activeTemplates} loading={templatesLoading} />
      </Box>

      <Card data-tour="documents-list" sx={{ p: 0, overflow: 'hidden', borderRadius: '18px' }}>
        {/* Título + filtros + ações */}
        <ListCardHeader
          breakpoint="xl"
          sx={{ py: 2.25 }}
          title={
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h3" sx={{ fontSize: fontSizes.xl, fontWeight: 700 }}>
                Documentos
                {!loading && docs.length > 0 && (
                  <Box component="span" sx={{ color: 'text.disabled', fontWeight: 500, fontSize: fontSizes.sm }}>
                    {` · ${filteredDocs.length} de ${docs.length}`}
                  </Box>
                )}
              </Typography>
              {!loading && stats.totalBytes > 0 && (
                <Typography sx={{ fontSize: fontSizes.xs, color: 'text.disabled', fontWeight: 600 }}>
                  {fmtStorageTotal(stats.totalBytes)} em arquivos
                  {stats.byStatus.SENT > 0 && ` · ${stats.byStatus.SENT} aguardando assinatura`}
                </Typography>
              )}
            </Box>
          }
        >
          <TextField
            select
            size="small"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'ALL' | DocumentStatus);
              setPage(0);
            }}
            inputProps={{ 'aria-label': 'Status' }}
            sx={TOOLBAR_SELECT_SX}
          >
            <MenuItem value="ALL">Todos os status</MenuItem>
            {DOCUMENT_STATUSES.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label} ({stats.byStatus[s.value]})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(0);
            }}
            inputProps={{ 'aria-label': 'Tipo' }}
            sx={TOOLBAR_SELECT_SX}
          >
            <MenuItem value="ALL">Todos os tipos</MenuItem>
            {documentCategories.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label} ({stats.byCategory[cat.value] ?? 0})
              </MenuItem>
            ))}
            <MenuItem value="__none__">Sem tipo ({stats.byCategory.__none__ ?? 0})</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={linkFilter}
            onChange={(e) => {
              setLinkFilter(e.target.value as LinkFilter);
              setPage(0);
            }}
            inputProps={{ 'aria-label': 'Vínculo' }}
            sx={TOOLBAR_SELECT_SX}
          >
            <MenuItem value="ALL">Todos os vínculos</MenuItem>
            <MenuItem value="PATIENT">Pacientes ({stats.patients})</MenuItem>
            <MenuItem value="EQUIPMENT">Equipamentos ({stats.equipment})</MenuItem>
            <MenuItem value="NONE">Sem vínculo ({stats.unlinked})</MenuItem>
          </TextField>
          <ListSearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(0);
            }}
            placeholder="Buscar documento, paciente..."
          />
          <Tooltip title="Modelos de documento">
            <IconButton aria-label="Modelos de documento" onClick={() => setTemplatesOpen(true)} sx={LIST_HEADER_ICON_BUTTON_SX}>
              <ArticleOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canCreate && (
            <Button data-tour="documents-new" variant="contained" startIcon={<AddIcon />} onClick={openNew} sx={LIST_HEADER_PRIMARY_ACTION_SX}>
              Novo documento
            </Button>
          )}
        </ListCardHeader>

        <Box sx={{ overflowX: 'auto' }}>
          {/* Cabeçalho de colunas */}
          <ListTableHeader
            columns={DOCUMENT_GRID_COLS}
            sx={{
              display: { xs: 'none', md: 'grid' },
              minWidth: DOCUMENT_GRID_MIN_WIDTH,
              px: 2.75,
              py: 1.6,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            <span>Documento</span>
            <span>Paciente</span>
            <span>Tipo</span>
            <span>Data</span>
            <span>Status</span>
            <span />
          </ListTableHeader>

          {loading ? (
            <Box sx={{ px: 2.75, py: 2 }}>
              <Stack spacing={1.25}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={48} />
                ))}
              </Stack>
            </Box>
          ) : filteredDocs.length === 0 ? (
            <ListEmptyState
              icon={DescriptionOutlinedIcon}
              sx={{ px: 3, py: 6 }}
              title={docs.length === 0 ? 'Nenhum documento cadastrado' : 'Nenhum documento encontrado'}
              description={
                docs.length === 0
                  ? 'Gere termos a partir dos modelos ou envie contratos, certificados e arquivos da clínica.'
                  : 'Tente ajustar a busca ou os filtros.'
              }
            >
              {canCreate && docs.length === 0 && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} sx={{ mt: 2 }}>
                  Novo documento
                </Button>
              )}
            </ListEmptyState>
          ) : (
            rows.map((doc) => (
              <DocumentListRow
                key={doc.id}
                doc={doc}
                canEdit={canEdit}
                onClick={() => handleRowClick(doc)}
                onOpenMenu={(anchor) => setMenu({ anchor, doc })}
              />
            ))
          )}
        </Box>

        {/* Paginação */}
        {!loading && pageCount > 1 && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            sx={{ px: 2.75, py: 1.75, borderTop: 1, borderColor: 'divider' }}
          >
            <Typography sx={{ fontSize: fontSizes.xs, color: 'text.secondary', fontWeight: 600 }}>
              Mostrando {rangeStart}–{rangeEnd} de{' '}
              {filteredDocs.length}
            </Typography>
            <ListPageButtons
              page={current}
              pageCount={pageCount}
              onChange={setPage}
              size={32}
              radius="9px"
              px={0.75}
              spacing={0.75}
              wrapJustify="center"
            />
          </Stack>
        )}
      </Card>

      <DocumentActionsMenu
        anchor={menu?.anchor}
        doc={menu?.doc}
        onClose={() => setMenu(null)}
        canEdit={canEdit}
        canDelete={canDelete}
        attachPending={attachMutation.isPending}
        onOpenFile={(d) => void handleOpenDocument(d)}
        onView={setViewing}
        onAttach={startAttach}
        onSend={setSending}
        onSetStatus={(d, status) => statusMutation.mutate({ id: d.id, status })}
        onEdit={(d) => {
          setEditing(d);
          setFormOpen(true);
        }}
        onDelete={(d) => void handleDelete(d)}
      />

      <input
        ref={attachInputRef}
        type="file"
        hidden
        accept={UPLOAD_ACCEPT}
        onChange={(e) => {
          handleAttachSelected(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <DocumentFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
        onSaved={handleSaved}
      />
      <DocumentViewerDialog
        doc={viewing}
        onClose={() => setViewing(null)}
        onAttach={canEdit ? startAttach : undefined}
        onSend={canEdit ? setSending : undefined}
      />
      <SendDocumentDialog
        doc={sending}
        onClose={() => setSending(null)}
        onSent={(saved) => setViewing((v) => (v?.id === saved.id ? saved : v))}
      />
      <DocumentTemplatesDialog
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </Stack>
  );
}
