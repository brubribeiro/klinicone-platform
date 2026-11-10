import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

import { appointmentsApi, AppointmentPayload } from '../../api/appointments';
import { paymentMethodsApi } from '../../api/paymentMethods';
import { patientsApi } from '../../api/patients';
import { proceduresApi } from '../../api/procedures';
import { packagesApi } from '../../api/packages';
import { inventoryApi } from '../../api/inventory';
import { useAppDialog } from '../../contexts/AppDialogContext';
import { useAppToast } from '../../contexts/AppToastContext';
import { usePermissions } from '../../contexts/usePermissions';
import { DialogHeader } from '../DialogCloseButton';
import { ApplicationMapDialog } from '../application-map/ApplicationMapDialog';
import {
  EMPTY_MAP_DRAFT,
  guessProducts,
  toApplicationMapPayload,
  toMapDraft,
  type ApplicationMapDraft,
} from '../application-map/applicationMapModel';
import { SendWhatsAppDialog } from '../messages/SendWhatsAppDialog';
import { PatientDetailDrawer } from '../patients/PatientDetailDrawer';
import { SkinAnamnesisDialog } from '../skincare/SkinAnamnesisDialog';
import { varsFromAppointment } from '../../utils/whatsapp';
import { getApiErrorMessage } from '../../utils/apiError';
import { appointmentProcedureIds } from '../../utils/appointmentProcedures';
import type {
  Appointment,
  Package,
  PaymentMethodEntry,
  Procedure,
} from '../../types';
import {
  invalidateAppointmentListQueries,
  isAppointmentListQuery,
  removeAppointmentFromCache,
  restoreAppointmentLists,
  snapshotAppointmentLists,
} from './appointmentCache';
import {
  appointmentToFormValues,
  emptyFormValues,
  formatElapsed,
  kindOptions,
  normalizeExtraMaterials,
  reconcileProcedureIds,
  type ExtraMaterialRow,
  resolveAppointmentEnd,
  totalProcedureDurationMinutes,
  type FormValues,
  type SectionKey,
} from './appointmentFormModel';
import type { SectionState } from './AppointmentFormSection';
import { ApplicationMapShortcut } from './ApplicationMapShortcut';
import { AppointmentStatusSelect } from './AppointmentStatusSelect';
import {
  AppointmentSummaryBar,
  AppointmentSummaryPanel,
  type AppointmentSummaryData,
  type PromotionSummary,
} from './AppointmentSummary';
import { BatchSessionsDialog, type BatchTarget } from './BatchSessionsDialog';
import { CompletePaymentDialog } from './CompletePaymentDialog';
import { MaterialsSection, useAppointmentMaterials } from './MaterialsSection';
import { NotesSection } from './NotesSection';
import { PackageSection } from './PackageSection';
import { PackageSessionsDialog } from './PackageSessionsDialog';
import { PatientSection } from './PatientSection';
import { ReturnAppointmentDialog } from './ReturnAppointmentDialog';
import { ScheduleSection } from './ScheduleSection';
import { SellPackageDialog } from './SellPackageDialog';
import { ServiceSection } from './ServiceSection';
import { SessionTimerCard, SessionTimerCompact } from './SessionTimerCard';
import { SkinAnamnesisShortcut } from './SkinAnamnesisShortcut';
import { useAppointmentProfessionals } from './useAppointmentProfessionals';
import { useSessionTimer } from './useSessionTimer';

interface AppointmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  defaultStart?: Date | null;
  defaultPatientId?: string | null;
}

const SECTION_ORDER: SectionKey[] = [
  'patient',
  'service',
  'schedule',
  'package',
  'materials',
  'notes',
];

const DEFAULT_EXPANDED: Record<SectionKey, boolean> = {
  patient: true,
  service: true,
  schedule: true,
  package: false,
  materials: false,
  notes: false,
};

export function AppointmentFormDialog({
  open,
  onClose,
  appointment,
  defaultStart,
  defaultPatientId,
}: AppointmentFormDialogProps) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const showSidebar = useMediaQuery(muiTheme.breakpoints.up('lg'));

  const queryClient = useQueryClient();
  const { confirm } = useAppDialog();
  const toast = useAppToast();
  const { has } = usePermissions();
  const canDelete = has('appointments:delete');
  const canCreate = has('appointments:create');
  const canViewPatient = has('patients:view');

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues: emptyFormValues });
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>(DEFAULT_EXPANDED);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingReturn, setPendingReturn] = useState<Appointment | null>(null);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<FormValues | null>(null);
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false);
  const [extraMaterials, setExtraMaterials] = useState<ExtraMaterialRow[]>([]);
  const [chartPatientId, setChartPatientId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [sellPackageTarget, setSellPackageTarget] = useState<Package | null>(null);
  const [batchTarget, setBatchTarget] = useState<BatchTarget | null>(null);
  /** Materiais extras como estavam ao abrir, para detectar alterações não salvas. */
  const initialExtrasRef = useRef('[]');
  const [mapDraft, setMapDraft] = useState<ApplicationMapDraft>(EMPTY_MAP_DRAFT);
  const [initialMapDraft, setInitialMapDraft] = useState<ApplicationMapDraft>(EMPTY_MAP_DRAFT);
  // Só habilita a busca de profissionais depois que o formulário foi inicializado
  // com os valores reais (reset), evitando uma requisição extra com o horário padrão.
  const [formInitialized, setFormInitialized] = useState(false);

  const { data: appointmentDetail } = useQuery({
    queryKey: ['appointment', appointment?.id],
    queryFn: () => appointmentsApi.findOne(appointment!.id),
    enabled: open && !!appointment?.id,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list(),
    enabled: open,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients', ''],
    queryFn: () => patientsApi.list(),
    enabled: open,
  });
  const { data: procedures = [], isSuccess: proceduresLoaded } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => proceduresApi.list(),
    enabled: open,
  });

  const { data: paymentMethods = [] } = useQuery<PaymentMethodEntry[]>({
    queryKey: ['payment-methods'],
    queryFn: () => paymentMethodsApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setFormInitialized(false);
      return;
    }
    if (appointment) {
      reset(appointmentToFormValues(appointment));
    } else {
      const start = defaultStart ?? new Date();
      const isMidnight = start.getHours() === 0 && start.getMinutes() === 0;
      reset({
        ...emptyFormValues,
        patientId: defaultPatientId ?? '',
        date: dayjs(start).format('YYYY-MM-DD'),
        startTime: isMidnight ? '09:00' : dayjs(start).format('HH:mm'),
      });
    }
    setExpanded({
      ...DEFAULT_EXPANDED,
      package: !!appointment?.patientPackageId,
      materials: !!appointment?.extraMaterials?.length,
      notes: !!(appointment?.notes?.trim() || appointment?.clinicalNotes?.trim()),
    });
    setFormInitialized(true);
  }, [open, appointment, defaultStart, defaultPatientId, reset]);

  useEffect(() => {
    if (!open) return;
    const source = appointmentDetail ?? appointment;
    if (source?.extraMaterials?.length) {
      const rows = source.extraMaterials.map((m) => ({
        itemId: m.itemId,
        quantity: Number(m.quantity),
      }));
      initialExtrasRef.current = JSON.stringify(normalizeExtraMaterials(rows));
      setExtraMaterials(rows);
    } else if (!appointment) {
      initialExtrasRef.current = '[]';
      setExtraMaterials([]);
    }
  }, [open, appointment, appointmentDetail]);

  useEffect(() => {
    if (!open) return;
    const draft = toMapDraft((appointmentDetail ?? appointment)?.applicationMap);
    setMapDraft(draft);
    setInitialMapDraft(draft);
  }, [open, appointment, appointmentDetail]);

  const selectedKind = watch('kind');
  const selectedProcedureIds = watch('procedureIds');
  const selectedStatus = watch('status');
  const selectedPatientId = watch('patientId');
  const selectedDate = watch('date');
  const selectedStartTime = watch('startTime');
  const selectedProfessionalId = watch('professionalId');
  const notes = watch('notes');
  const clinicalNotes = watch('clinicalNotes');

  const materialsEnabled = selectedKind === 'PROCEDURE' && selectedProcedureIds.length > 0;

  const procedureOptions = useMemo(() => {
    const byId = new Map<string, Procedure>(procedures.map((p) => [p.id, p]));
    const source = appointmentDetail ?? appointment;
    for (const row of source?.appointmentProcedures ?? []) {
      if (row.procedure?.id && !byId.has(row.procedure.id)) {
        byId.set(row.procedure.id, row.procedure as Procedure);
      }
    }
    if (source?.procedure?.id && !byId.has(source.procedure.id)) {
      byId.set(source.procedure.id, source.procedure as Procedure);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [procedures, appointment, appointmentDetail]);
  const selectedProcedures = useMemo(
    () =>
      selectedProcedureIds
        .map((id) => procedureOptions.find((p) => p.id === id))
        .filter((p): p is Procedure => !!p),
    [procedureOptions, selectedProcedureIds],
  );
  const selectedProcedure = selectedProcedures[0];
  const totalDurationMinutes = totalProcedureDurationMinutes(procedureOptions, selectedProcedureIds);

  // Lê o tipo com getValues: ao abrir outro agendamento, o reset roda no mesmo commit e
  // selectedKind ainda é o do agendamento aberto antes (apagaria os procedimentos).
  useEffect(() => {
    if (!open) return;
    const currentIds = getValues('procedureIds');
    const nextIds = reconcileProcedureIds(
      getValues('kind'),
      currentIds,
      procedureOptions,
      proceduresLoaded,
    );
    if (nextIds.length !== currentIds.length) {
      setValue('procedureIds', nextIds);
    }
  }, [open, selectedKind, procedureOptions, proceduresLoaded, getValues, setValue]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Mapa de aplicação: só ao editar, quando algum procedimento usa o mapa (um só mapa por
  // atendimento); mantém visível se já houver pontos salvos mesmo que deixe de usar.
  const showApplicationMap =
    !!appointment &&
    selectedKind === 'PROCEDURE' &&
    (selectedProcedures.some((p) => p.applicationMap) ||
      initialMapDraft.points.length > 0 ||
      initialMapDraft.strokes.length > 0);
  const mapProcedures = selectedProcedures.filter((p) => p.applicationMap);
  const mapProducts = guessProducts(mapProcedures.map((p) => p.name));
  const mapRegions = [
    ...new Set(mapProcedures.map((p): 'face' | 'body' => (p.category === 'Corporal' ? 'body' : 'face'))),
  ];

  const { data: activePatientPackages = [] } = useQuery({
    queryKey: ['patient-packages-active', selectedPatientId],
    queryFn: () => packagesApi.listActiveForPatient(selectedPatientId),
    enabled: open && !!selectedPatientId,
  });

  const { data: selectedPackageDetail } = useQuery({
    queryKey: ['patient-package-detail', selectedPackageId],
    queryFn: () => packagesApi.findPatientPackage(selectedPackageId),
    enabled: open && !!selectedPackageId,
  });

  const packageSessions = useMemo(
    () =>
      [...(selectedPackageDetail?.appointments ?? [])].sort((a, b) =>
        dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf(),
      ),
    [selectedPackageDetail],
  );

  const recurrenceQueries = useQueries({
    queries: selectedProcedureIds.map((procedureId) => ({
      queryKey: ['appointment-recurrence-limit', selectedPatientId, procedureId, appointment?.id],
      queryFn: () =>
        appointmentsApi.getRecurrenceLimit(selectedPatientId, procedureId, appointment?.id),
      enabled: open && !!selectedPatientId && selectedKind === 'PROCEDURE',
    })),
  });

  const recurrenceEarliestDate = useMemo(() => {
    let latest: string | null = null;
    for (const query of recurrenceQueries) {
      const d = query.data?.earliestDate;
      if (d && (!latest || d > latest)) latest = d;
    }
    return latest;
  }, [recurrenceQueries]);

  const recurrenceDays = recurrenceQueries.find((q) => q.data?.recurrenceDays)?.data?.recurrenceDays ?? null;

  const { data: allCatalogPackages = [] } = useQuery({
    queryKey: ['packages'],
    queryFn: () => packagesApi.list(),
    enabled: open,
  });

  // Pacote vale se cobre ao menos um dos procedimentos; os demais são cobrados avulsos.
  const filteredPatientPackages = useMemo(() => {
    if (selectedProcedureIds.length === 0) return [];
    return activePatientPackages.filter((pp) =>
      selectedProcedureIds.some((pid) =>
        pp.package?.items?.some((item) => item.procedureId === pid),
      ),
    );
  }, [activePatientPackages, selectedProcedureIds]);

  const availableCatalogPackages = useMemo(() => {
    if (selectedProcedureIds.length === 0) return [];
    const activePackageIds = new Set(activePatientPackages.map((pp) => pp.packageId));
    return allCatalogPackages.filter(
      (pkg) =>
        pkg.active &&
        selectedProcedureIds.some((pid) => pkg.items?.some((item) => item.procedureId === pid)) &&
        !activePackageIds.has(pkg.id),
    );
  }, [allCatalogPackages, selectedProcedureIds, activePatientPackages]);

  useEffect(() => {
    if (appointment?.patientPackageId) {
      setSelectedPackageId(appointment.patientPackageId);
    } else {
      setSelectedPackageId('');
    }
  }, [selectedPatientId, selectedProcedureIds, appointment?.patientPackageId]);

  const selectedPatientPkg = useMemo(
    () => filteredPatientPackages.find((pp) => pp.id === selectedPackageId),
    [filteredPatientPackages, selectedPackageId],
  );

  // Sessões ativas já agendadas (ignora canceladas) e quantas faltam agendar
  const scheduledActiveCount = useMemo(
    () => packageSessions.filter((s) => s.status !== 'CANCELLED').length,
    [packageSessions],
  );
  const missingSessions = Math.max(
    (selectedPatientPkg?.sessionsTotal ?? 0) - scheduledActiveCount,
    0,
  );

  // Procedimentos cobertos pelo pacote selecionado; os outros entram como avulsos.
  const packageCoveredIds = useMemo(
    () =>
      new Set(
        selectedPackageId && selectedPatientPkg
          ? (selectedPatientPkg.package?.items ?? []).map((item) => item.procedureId)
          : [],
      ),
    [selectedPackageId, selectedPatientPkg],
  );
  const billableProcedures = useMemo(
    () => selectedProcedures.filter((p) => !packageCoveredIds.has(p.id)),
    [selectedProcedures, packageCoveredIds],
  );

  // Prévia da promoção do dia por procedimento avulso que ainda não gerou receita
  // (sessão de pacote usa o valor do pacote, com a promoção aplicada na venda).
  const previewDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate ?? '') ? selectedDate : '';
  const promotionPreviewEnabled =
    open && selectedKind === 'PROCEDURE' && !!previewDate && !appointment?.financeGenerated;
  const promotionQueries = useQueries({
    queries: billableProcedures.map((procedure) => ({
      queryKey: ['promotion-preview', procedure.id, previewDate],
      queryFn: () => appointmentsApi.promotionPreview(procedure.id, previewDate),
      enabled: promotionPreviewEnabled,
      staleTime: 60_000,
    })),
  });
  const billableAmount = billableProcedures.reduce((sum, procedure, i) => {
    const quote = promotionPreviewEnabled ? promotionQueries[i]?.data : undefined;
    return sum + (quote?.promotion ? quote.finalPrice : Number(procedure.price ?? 0));
  }, 0);
  const promotionQuotes = promotionPreviewEnabled
    ? promotionQueries.flatMap((q) => (q.data?.promotion ? [q.data] : []))
    : [];

  const packageAmount =
    selectedPatientPkg && selectedPackageId && !selectedPatientPkg.financeGenerated
      ? Number(selectedPatientPkg.totalPaid)
      : 0;
  const paymentAmountOnComplete = packageAmount + billableAmount;
  const promotionDiscount = promotionQuotes.reduce((sum, q) => sum + q.discount, 0);
  const promotionSummary: PromotionSummary | undefined =
    promotionQuotes.length > 0
      ? {
          name: [...new Set(promotionQuotes.map((q) => q.promotion!.name))].join(', '),
          originalPrice: paymentAmountOnComplete + promotionDiscount,
          discount: promotionDiscount,
        }
      : undefined;

  // Mês de referência (competência) — relevante para agendamentos de meses passados
  const appointmentMonthKey = appointment ? dayjs(appointment.startAt).format('YYYY-MM') : '';
  const currentMonthKey = dayjs().format('YYYY-MM');

  const needsPaymentOnComplete = useCallback(
    (values: FormValues) => {
      if (!appointment || appointment.status === 'COMPLETED') return false;
      if (values.status !== 'COMPLETED' || values.kind !== 'PROCEDURE' || values.procedureIds.length === 0) {
        return false;
      }
      if (selectedPackageId && selectedPatientPkg) {
        return !selectedPatientPkg.financeGenerated;
      }
      return !appointment.financeGenerated;
    },
    [appointment, selectedPackageId, selectedPatientPkg],
  );

  const professionals = useAppointmentProfessionals({
    open,
    formInitialized,
    appointment,
    appointmentDetail,
    durationMinutes: totalDurationMinutes,
    selectedDate,
    selectedStartTime,
    selectedProfessionalId,
    setValue,
  });
  const {
    appointmentProviders,
    slotEnd,
    slotValid,
    checkingAvailability,
    professionalOptions,
    assignedProfessional,
    selectedProfessional,
    selectedPerformsAppointments,
    loggedUserCannotBeScheduled,
    noProfessionalAvailable,
    professionalSlotConflict,
    requiresValidProvider,
    blockingMessage,
  } = professionals;

  const willDeductMaterials =
    selectedStatus === 'SCHEDULED' ||
    selectedStatus === 'CONFIRMED' ||
    selectedStatus === 'IN_PROGRESS' ||
    selectedStatus === 'COMPLETED';

  const materialsState = useAppointmentMaterials({
    inventory,
    appointmentSource: appointmentDetail ?? appointment,
    procedureOptions,
    selectedProcedures,
    extraMaterials,
  });
  const stockBlocksSave = willDeductMaterials && materialsState.hasInsufficient && selectedKind === 'PROCEDURE';

  useEffect(() => {
    if (stockBlocksSave && materialsEnabled) {
      setExpanded((prev) => (prev.materials ? prev : { ...prev, materials: true }));
    }
  }, [stockBlocksSave, materialsEnabled]);

  const normalizedExtraMaterials = useMemo(
    () => normalizeExtraMaterials(extraMaterials),
    [extraMaterials],
  );

  const mapPayload = useMemo(() => toApplicationMapPayload(mapDraft), [mapDraft]);
  const mapChanged =
    showApplicationMap &&
    JSON.stringify(mapPayload) !== JSON.stringify(toApplicationMapPayload(initialMapDraft));

  const hasUnsavedChanges =
    isDirty ||
    JSON.stringify(normalizedExtraMaterials) !== initialExtrasRef.current ||
    mapChanged ||
    selectedPackageId !== (appointment?.patientPackageId ?? '');

  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.remove(id),
    onMutate: async (id) => {
      onClose();
      await queryClient.cancelQueries({ predicate: isAppointmentListQuery });
      const previous = snapshotAppointmentLists(queryClient);
      removeAppointmentFromCache(queryClient, id);
      return { previous };
    },
    onSuccess: () => {
      toast.success('Agendamento excluído.');
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        restoreAppointmentLists(queryClient, context.previous);
      }
      toast.error(getApiErrorMessage(err, 'Não foi possível excluir o agendamento.'));
    },
    onSettled: () => {
      invalidateAppointmentListQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const timer = useSessionTimer({
    open,
    appointment,
    appointmentDetail,
    onStarted: () => setValue('status', 'IN_PROGRESS'),
  });

  const mutation = useMutation({
    mutationFn: ({
      values,
      paymentMethodId,
      referenceMonth,
      installments,
      cardBrand,
      authorizationCode,
    }: {
      values: FormValues;
      paymentMethodId?: string;
      referenceMonth?: string;
      installments?: number;
      cardBrand?: string;
      authorizationCode?: string;
    }) => {
      const start = dayjs(`${values.date}T${values.startTime}`);
      if (!start.isValid()) {
        throw new Error('Data ou horário inválidos.');
      }
      const end = resolveAppointmentEnd(start, values.procedureIds, procedureOptions, appointment);
      if (!end.isValid() || !end.isAfter(start)) {
        throw new Error('Intervalo de horário inválido.');
      }

      const procedureIds =
        values.kind === 'PROCEDURE'
          ? values.procedureIds.filter(Boolean)
          : [];

      const payload: AppointmentPayload = {
        patientId: values.patientId,
        professionalId: values.professionalId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        status: appointment ? values.status : 'SCHEDULED',
        kind: values.kind,
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
        ...(values.clinicalNotes.trim() ? { clinicalNotes: values.clinicalNotes.trim() } : {}),
        ...(paymentMethodId ? { paymentMethodId } : {}),
        ...(referenceMonth ? { referenceMonth } : {}),
        ...(installments ? { installments } : {}),
        ...(cardBrand ? { cardBrand } : {}),
        ...(authorizationCode ? { authorizationCode } : {}),
        ...(procedureIds.length > 0 ? { procedureIds, procedureId: procedureIds[0] } : {}),
        ...(selectedPackageId ? { patientPackageId: selectedPackageId } : {}),
        ...(normalizedExtraMaterials.length > 0 ? { extraMaterials: normalizedExtraMaterials } : {}),
        ...(appointment && mapChanged
          ? { applicationMap: mapPayload }
          : {}),
      };
      return appointment
        ? appointmentsApi.update(appointment.id, payload)
        : appointmentsApi.create(payload);
    },
    onSuccess: (saved) => {
      invalidateAppointmentListQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['patient-packages-active'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', saved.id] });
      queryClient.invalidateQueries({ queryKey: ['patient', saved.patientId] });
      toast.success(appointment ? 'Agendamento atualizado.' : 'Agendamento criado.');
      const wasNotCompleted = appointment?.status !== 'COMPLETED';
      const isNowCompleted = saved.status === 'COMPLETED';
      if (
        wasNotCompleted &&
        isNowCompleted &&
        canCreate &&
        saved.kind === 'PROCEDURE' &&
        appointmentProcedureIds(saved).length > 0
      ) {
        const ids = appointmentProcedureIds(saved);
        setPendingReturn({
          ...(saved as Appointment),
          professionalId:
            saved.professionalId ?? saved.professional?.id ?? getValues().professionalId,
          procedureId: ids[0] ?? saved.procedureId ?? '',
        });
      } else {
        onClose();
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Não foi possível salvar o agendamento.'));
    },
  });

  const requestClose = useCallback(async () => {
    if (mutation.isPending) return;
    if (hasUnsavedChanges) {
      const discard = await confirm({
        title: 'Descartar alterações?',
        message: appointment
          ? 'As alterações feitas neste agendamento ainda não foram salvas.'
          : 'Os dados preenchidos para este novo agendamento ainda não foram salvos.',
        subtitle: 'Alterações não salvas',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        confirmColor: 'error',
      });
      if (!discard) return;
    }
    onClose();
  }, [mutation.isPending, hasUnsavedChanges, confirm, appointment, onClose]);

  const handleConfirmFinishSession = async () => {
    setConfirmFinishOpen(false);
    if (!appointment) return;

    await timer.stopTimerIfRunning();

    const values: FormValues = { ...getValues(), status: 'COMPLETED' };
    setValue('status', 'COMPLETED');

    if (needsPaymentOnComplete(values)) {
      setPendingFormValues(values);
      return;
    }

    mutation.mutate({ values });
  };

  const onSubmit = (values: FormValues) => {
    if (loggedUserCannotBeScheduled || noProfessionalAvailable || professionalSlotConflict) {
      return;
    }
    if (!values.professionalId || !selectedPerformsAppointments) {
      setExpanded((prev) => ({ ...prev, service: true }));
      toast.warning('Selecione um profissional que realiza atendimentos e esteja disponível neste horário.');
      return;
    }
    if (values.kind === 'PROCEDURE' && selectedProcedures.length === 0) {
      setExpanded((prev) => ({ ...prev, service: true }));
      toast.warning('Selecione ao menos um procedimento válido antes de salvar.');
      return;
    }

    if (needsPaymentOnComplete(values)) {
      setPendingFormValues(values);
    } else {
      mutation.mutate({ values });
    }
  };

  const onInvalid = (formErrors: FieldErrors<FormValues>) => {
    setExpanded((prev) => ({
      ...prev,
      patient: prev.patient || !!formErrors.patientId,
      service: prev.service || !!formErrors.procedureIds || !!formErrors.professionalId,
      schedule: prev.schedule || !!formErrors.date || !!formErrors.startTime,
    }));
    toast.warning('Revise os campos destacados antes de salvar.');
  };

  const confirmPaymentAndSave = async (data: {
    paymentMethodId: string;
    referenceMonth: string;
    installments?: number;
    cardBrand?: string;
    authorizationCode?: string;
  }) => {
    if (!pendingFormValues) return;
    await timer.stopTimerIfRunning();
    const ref = data.referenceMonth || appointmentMonthKey;
    mutation.mutate({
      values: pendingFormValues,
      paymentMethodId: data.paymentMethodId || undefined,
      referenceMonth: ref && ref !== currentMonthKey ? ref : undefined,
      installments: data.installments,
      cardBrand: data.cardBrand,
      authorizationCode: data.authorizationCode,
    });
    setPendingFormValues(null);
  };

  const sectionStates: Record<SectionKey, SectionState> = {
    patient: errors.patientId ? 'error' : selectedPatientId ? 'complete' : 'pending',
    service:
      errors.procedureIds || errors.professionalId || blockingMessage
        ? 'error'
        : (selectedKind !== 'PROCEDURE' || selectedProcedures.length > 0) &&
            (selectedProfessional || (professionals.restrictToOwnAppointments && assignedProfessional))
          ? 'complete'
          : 'pending',
    schedule: errors.date || errors.startTime || !slotValid ? 'error' : 'complete',
    package: selectedPatientPkg ? 'complete' : 'pending',
    materials: materialsEnabled ? (stockBlocksSave ? 'error' : 'complete') : 'pending',
    notes: notes.trim() || clinicalNotes.trim() ? 'complete' : 'pending',
  };

  const section = (key: SectionKey) => ({
    step: SECTION_ORDER.indexOf(key) + 1,
    expanded: expanded[key],
    onToggle: () => setExpanded((prev) => ({ ...prev, [key]: !prev[key] })),
    state: sectionStates[key],
  });

  const summaryData: AppointmentSummaryData = {
    patientName: selectedPatient?.name,
    serviceLabel:
      selectedKind === 'PROCEDURE'
        ? selectedProcedures.length > 0
          ? selectedProcedures.map((p) => p.name).join(' + ')
          : 'Procedimento não selecionado'
        : (kindOptions.find((o) => o.value === selectedKind)?.label ?? ''),
    professionalName: professionals.restrictToOwnAppointments
      ? (assignedProfessional?.name ?? professionals.user?.name)
      : selectedProfessional?.name,
    dateLabel: slotValid ? dayjs(selectedDate).locale('pt-br').format('ddd, DD/MM/YYYY') : undefined,
    timeLabel: slotValid ? `${selectedStartTime} – ${slotEnd.format('HH:mm')}` : undefined,
    durationMinutes: totalDurationMinutes,
    packageLabel: selectedPatientPkg
      ? `${selectedPatientPkg.package?.name ?? 'Pacote'} · ${selectedPatientPkg.sessionsUsed}/${selectedPatientPkg.sessionsTotal}`
      : 'Avulso',
    amount: paymentAmountOnComplete,
    promotion: promotionSummary,
    status: appointment ? selectedStatus : undefined,
    blockingMessage,
    stockWarning: materialsEnabled && stockBlocksSave,
  };

  const showTimerCard = !!appointment && (timer.showSessionControls || timer.isInProgress || timer.hasStartedAt);
  const skinShortcut = appointment && selectedPatient && has('routines:create') && (
    <SkinAnamnesisShortcut onClick={() => setSkinOpen(true)} />
  );
  const mapShortcut = showApplicationMap && (
    <ApplicationMapShortcut
      pointsCount={mapDraft.points.length}
      strokesCount={mapDraft.strokes.length}
      onClick={() => setMapOpen(true)}
    />
  );
  const timerCard = showTimerCard && !isMobile && (
    <SessionTimerCard
      timer={timer}
      finishDisabled={mutation.isPending}
      onFinish={() => setConfirmFinishOpen(true)}
    />
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={() => void requestClose()}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            maxWidth: isMobile ? '100%' : 1120,
            width: '100%',
            height: isMobile ? '100%' : 'min(94dvh, 840px)',
            maxHeight: isMobile ? '100%' : '94dvh',
            borderRadius: isMobile ? 0 : '20px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
        >
          <DialogHeader
            onClose={() => void requestClose()}
            isMobile={isMobile}
            title={appointment ? 'Editar agendamento' : 'Novo agendamento'}
            subtitle={
              !isMobile
                ? selectedPatient
                  ? `${selectedPatient.name}${slotValid ? ` · ${dayjs(selectedDate).format('DD/MM/YYYY')} às ${selectedStartTime}` : ''}`
                  : 'Preencha os dados do atendimento'
                : undefined
            }
            icon={<EventAvailableOutlinedIcon fontSize="small" />}
            sx={{ pt: { xs: 1.5, sm: 2.5 }, bgcolor: 'background.paper' }}
            trailing={appointment && !isMobile ? <AppointmentStatusSelect control={control} /> : undefined}
            bottom={
              appointment && isMobile ? (
                <Stack spacing={1}>
                  <SessionTimerCompact
                    timer={timer}
                    finishDisabled={mutation.isPending}
                    onFinish={() => setConfirmFinishOpen(true)}
                  />
                  <AppointmentStatusSelect control={control} compact />
                </Stack>
              ) : undefined
            }
          />

          <DialogContent
            sx={{
              p: 0,
              '&&': { pt: 0 },
              bgcolor: 'grey.50',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                overflowY: 'auto',
                px: { xs: 1.5, sm: 2.5 },
                py: { xs: 1.5, sm: 2 },
              }}
            >
              <Stack spacing={1.5}>
                {mutation.isError && (
                  <Alert severity="error">
                    {getApiErrorMessage(mutation.error, 'Erro ao salvar agendamento')}
                  </Alert>
                )}
                {!showSidebar && skinShortcut}
                {!showSidebar && mapShortcut}
                {!showSidebar && timerCard}
                <PatientSection
                  section={section('patient')}
                  control={control}
                  open={open}
                  patients={patients}
                  selectedPatient={selectedPatient}
                />
                <ServiceSection
                  section={section('service')}
                  control={control}
                  selectedKind={selectedKind}
                  procedureOptions={procedureOptions}
                  selectedProcedures={selectedProcedures}
                  totalDurationMinutes={totalDurationMinutes}
                  professionals={professionals}
                />
                <ScheduleSection
                  section={section('schedule')}
                  control={control}
                  selectedDate={selectedDate}
                  selectedStartTime={selectedStartTime}
                  slotEnd={slotEnd}
                  slotValid={slotValid}
                  recurrenceEarliestDate={recurrenceEarliestDate}
                  recurrenceDays={recurrenceDays}
                />
                <PackageSection
                  section={section('package')}
                  isEditing={!!appointment}
                  selectedProcedures={selectedProcedures}
                  selectedPackageId={selectedPackageId}
                  onSelectPackage={setSelectedPackageId}
                  filteredPatientPackages={filteredPatientPackages}
                  selectedPatientPkg={selectedPatientPkg}
                  availableCatalogPackages={availableCatalogPackages}
                  packageSessionsCount={packageSessions.length}
                  paymentAmount={paymentAmountOnComplete}
                  onOpenSessions={() => setSessionsDialogOpen(true)}
                  onScheduleRemaining={(pkg) => setBatchTarget({ patientPkg: pkg, fillCount: null })}
                  onBuyPackage={setSellPackageTarget}
                />
                <MaterialsSection
                  section={section('materials')}
                  enabled={materialsEnabled}
                  inventory={inventory}
                  extraMaterials={extraMaterials}
                  setExtraMaterials={setExtraMaterials}
                  willDeductMaterials={willDeductMaterials}
                  materialsState={materialsState}
                />
                <NotesSection
                  section={section('notes')}
                  control={control}
                  notes={notes}
                  clinicalNotes={clinicalNotes}
                />
              </Stack>
            </Box>

            {showSidebar && (
              <Box
                component="aside"
                sx={{
                  width: 320,
                  flexShrink: 0,
                  borderLeft: 1,
                  borderColor: 'divider',
                  p: 2,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <AppointmentSummaryPanel data={summaryData}>
                  {skinShortcut}
                  {mapShortcut}
                  {timerCard}
                </AppointmentSummaryPanel>
              </Box>
            )}
          </DialogContent>

          {!showSidebar && <AppointmentSummaryBar data={summaryData} />}

          <DialogActions
            sx={{
              px: { xs: 1.5, sm: 3 },
              py: { xs: 1.5, sm: 2 },
              flexShrink: 0,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'grey.50',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              gap: isMobile ? 1 : 0,
            }}
          >
            {appointment && canViewPatient && selectedPatient && (
              <Button
                variant="outlined"
                startIcon={<DescriptionOutlinedIcon />}
                onClick={() => setChartPatientId(selectedPatient.id)}
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  mr: 1,
                  minWidth: 132,
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'grey.400', bgcolor: 'grey.50' },
                }}
              >
                Ver ficha
              </Button>
            )}
            {appointment && selectedPatient?.phone && (
              <Tooltip title="Enviar mensagem de confirmação via WhatsApp">
                <Button
                  startIcon={<WhatsAppIcon />}
                  onClick={() => setWhatsappOpen(true)}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{
                    color: '#1DAE53',
                    bgcolor: 'rgba(29,174,83,.10)',
                    border: '1px solid',
                    borderColor: 'rgba(29,174,83,.30)',
                    mr: 1,
                    minWidth: 132,
                    '&:hover': { bgcolor: 'rgba(29,174,83,.18)', borderColor: 'rgba(29,174,83,.45)' },
                  }}
                >
                  WhatsApp
                </Button>
              </Tooltip>
            )}
            {appointment && canDelete && (
              <Button
                color="error"
                startIcon={<DeleteOutlineIcon />}
                disabled={deleteMutation.isPending}
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  minWidth: 132,
                  bgcolor: (t) => alpha(t.palette.error.main, 0.1),
                  border: '1px solid',
                  borderColor: (t) => alpha(t.palette.error.main, 0.3),
                  '&:hover': {
                    bgcolor: (t) => alpha(t.palette.error.main, 0.18),
                    borderColor: (t) => alpha(t.palette.error.main, 0.45),
                  },
                }}
                onClick={async () => {
                  const patientName =
                    selectedPatient?.name ?? appointment.patient?.name ?? 'este paciente';
                  const when = dayjs(appointment.startAt).format('DD/MM/YYYY [às] HH:mm');
                  const ok = await confirm({
                    title: 'Excluir agendamento',
                    message: `Deseja excluir o agendamento de ${patientName} em ${when}?`,
                    confirmLabel: 'Excluir',
                    confirmColor: 'error',
                  });
                  if (ok) deleteMutation.mutate(appointment.id);
                }}
              >
                Excluir
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            {!isMobile && (
              <Button
                variant="outlined"
                onClick={() => void requestClose()}
                sx={{
                  mr: 1,
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'grey.400', bgcolor: 'grey.50' },
                }}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              fullWidth={isMobile}
              sx={{ boxShadow: (t) => `0 6px 16px -6px ${t.palette.primary.main}` }}
              disabled={
                mutation.isPending ||
                (checkingAvailability && professionalOptions.length === 0) ||
                loggedUserCannotBeScheduled ||
                noProfessionalAvailable ||
                professionalSlotConflict ||
                (requiresValidProvider && !selectedPerformsAppointments) ||
                stockBlocksSave
              }
            >
              {mutation.isPending
                ? 'Salvando...'
                : appointment
                  ? 'Salvar alterações'
                  : 'Confirmar agendamento'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {appointment && selectedPatient && (
        <SkinAnamnesisDialog
          open={skinOpen}
          onClose={() => setSkinOpen(false)}
          patient={{ id: selectedPatient.id, name: selectedPatient.name, phone: selectedPatient.phone, email: selectedPatient.email }}
        />
      )}

      {showApplicationMap && (
        <ApplicationMapDialog
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          map={mapDraft}
          setMap={setMapDraft}
          products={mapProducts}
          defaultRegion={mapRegions.length === 1 ? mapRegions[0] : 'face'}
          regionLocked={mapRegions.length === 1}
        />
      )}

      {appointment && (
        <SendWhatsAppDialog
          open={whatsappOpen}
          onClose={() => setWhatsappOpen(false)}
          phone={selectedPatient?.phone}
          vars={varsFromAppointment({
            patient: selectedPatient,
            procedure: selectedProcedure,
            professional: appointmentProviders.find((p) => p.id === appointment.professionalId),
            startAt: appointment.startAt,
          })}
          preferredCategory="confirmacao"
          title="Enviar confirmação do agendamento"
        />
      )}

      <PackageSessionsDialog
        open={sessionsDialogOpen}
        onClose={() => setSessionsDialogOpen(false)}
        isMobile={isMobile}
        subtitle={
          selectedPackageDetail?.package?.name
            ? `${selectedPackageDetail.package.name} · ${selectedPatientPkg?.sessionsUsed ?? 0}/${
                selectedPatientPkg?.sessionsTotal ?? packageSessions.length
              } sessões usadas`
            : 'Agendamentos vinculados a este pacote'
        }
        sessions={packageSessions}
        currentAppointmentId={appointment?.id}
        missingSessions={missingSessions}
        onScheduleMissing={() => {
          setSessionsDialogOpen(false);
          if (selectedPatientPkg) {
            setBatchTarget({ patientPkg: selectedPatientPkg, fillCount: missingSessions });
          }
        }}
      />

      <CompletePaymentDialog
        open={!!pendingFormValues}
        isMobile={isMobile}
        patientName={selectedPatient?.name}
        procedureName={selectedProcedures.map((p) => p.name).join(' + ') || undefined}
        isPackage={!!(selectedPackageId && selectedPatientPkg)}
        amount={paymentAmountOnComplete}
        promotion={promotionSummary}
        paymentMethods={paymentMethods}
        appointmentMonthKey={appointmentMonthKey}
        isPending={mutation.isPending}
        onCancel={() => setPendingFormValues(null)}
        onConfirm={(data) => void confirmPaymentAndSave(data)}
      />

      <ReturnAppointmentDialog
        pendingReturn={pendingReturn}
        procedures={procedures}
        fallbackProcedures={selectedProcedures}
        onClose={() => {
          setPendingReturn(null);
          onClose();
        }}
      />

      <SellPackageDialog
        pkg={sellPackageTarget}
        patientId={selectedPatientId}
        patientName={selectedPatient?.name}
        procedures={procedures}
        paymentMethods={paymentMethods}
        onClose={() => setSellPackageTarget(null)}
        onCreated={(created) => {
          setSellPackageTarget(null);
          setSelectedPackageId(created.id);
          if (created.sessionsTotal > 1 && selectedProcedure?.recurrenceDays) {
            setBatchTarget({ patientPkg: created, fillCount: null });
          }
        }}
      />

      <BatchSessionsDialog
        target={batchTarget}
        procedure={selectedProcedure}
        packageSessions={packageSessions}
        patientId={selectedPatientId}
        professionalId={selectedProfessionalId}
        baseDate={selectedDate}
        baseStartTime={selectedStartTime}
        onClose={() => setBatchTarget(null)}
        onDone={() => {
          setBatchTarget(null);
          onClose();
        }}
      />

      <PatientDetailDrawer
        patientId={chartPatientId}
        onClose={() => setChartPatientId(null)}
        defaultTab="notes"
        highlightAppointmentId={appointment?.id ?? null}
      />

      <Dialog open={confirmFinishOpen} onClose={() => setConfirmFinishOpen(false)} maxWidth="xs">
        <DialogHeader
          onClose={() => setConfirmFinishOpen(false)}
          title="Concluir atendimento?"
          subtitle={`Tempo registrado: ${formatElapsed(timer.elapsed)}`}
        />
        <DialogContent>
          <Typography variant="body2">
            Tempo registrado: <strong>{formatElapsed(timer.elapsed)}</strong>.
            {timer.hasFinishedAt ? ' O cronômetro está pausado.' : ' O cronômetro será parado.'}
            {' '}O agendamento será marcado como <strong>Concluído</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmFinishOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            disabled={mutation.isPending}
            onClick={() => void handleConfirmFinishSession()}
          >
            {mutation.isPending ? 'Concluindo...' : 'Concluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
