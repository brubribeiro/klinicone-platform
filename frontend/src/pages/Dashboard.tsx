import { useState } from 'react';
import { Box } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

import { AppointmentFormDialog } from '../components/appointments/AppointmentFormDialog';
import { SendWhatsAppDialog } from '../components/messages/SendWhatsAppDialog';
import { usePermissions } from '../contexts/usePermissions';
import type { Appointment, Patient } from '../types';
import { UpcomingDatesCard } from '../components/dashboard/UpcomingDatesCard';
import { UpcomingExpensesCard } from '../components/dashboard/UpcomingExpensesCard';
import { GoalsCard } from '../components/dashboard/GoalsCard';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { WeekAgendaCard } from '../components/dashboard/WeekAgendaCard';
import { BirthdaysCard } from '../components/dashboard/BirthdaysCard';
import { useDashboardData } from '../components/dashboard/useDashboardData';
import { AppGrid } from '../components/AppGrid';
import { AuroraIcon } from '../components/AuroraIcon';
import { brl } from '../utils/money';

dayjs.locale('pt-br');

export function Dashboard() {
  const { has, restrictToOwnAppointments } = usePermissions();
  const canSeeFinance = has('finance:view');
  const canSeeAgenda = has('appointments:view');
  const canSeeGoals = has('goals:view');
  const canSeePatients = has('patients:view');
  const canSeeInventory = has('inventory:view');

  const {
    goalsAt,
    summary,
    summaryLoading,
    todayAppointmentsCount,
    appointmentsLoading,
    upcomingThisWeek,
    weekLoading,
    newPatientsCount,
    patientsLoading,
    lowStockCount,
    inventoryLoading,
    upcomingBirthdays,
  } = useDashboardData();

  const [weekApptDialogOpen, setWeekApptDialogOpen] = useState(false);
  const [editingWeekAppt, setEditingWeekAppt] = useState<Appointment | null>(null);
  const [whatsappPatient, setWhatsappPatient] = useState<Patient | null>(null);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 2, sm: 2.5 },
        width: '100%',
      }}
    >
      <AppGrid data-tour="dashboard-summary"
        columns={{ xs: 2, md: 4 }}
        gap={{ xs: 1.5, sm: 3 }}
        sx={{ flexShrink: 0 }}
      >
        {canSeeFinance ? (
          <SummaryCard
            label="Faturamento do mês"
            value={brl.format(summary?.totalIncome ?? 0)}
            hint={`Saldo: ${brl.format(summary?.balance ?? 0)}`}
            icon={<AuroraIcon name="money" size={19} />}
            color="success.main"
            to="/financeiro"
            loading={summaryLoading}
          />
        ) : (
          <SummaryCard
            label="Itens em baixa"
            value={String(lowStockCount)}
            hint="Abaixo do estoque mínimo"
            icon={<AuroraIcon name="estoque" size={19} />}
            color="warning.main"
            to={canSeeInventory ? '/estoque' : undefined}
            loading={inventoryLoading}
          />
        )}
        <SummaryCard
          label={restrictToOwnAppointments ? 'Meus agendamentos hoje' : 'Agendamentos hoje'}
          value={String(todayAppointmentsCount)}
          hint="Hoje"
          delta="—"
          icon={<AuroraIcon name="agenda" size={19} />}
          to={canSeeAgenda ? '/agenda' : undefined}
          loading={appointmentsLoading}
        />
        <SummaryCard
          label="Novos pacientes"
          value={String(newPatientsCount)}
          hint="no mês"
          delta="—"
          icon={<AuroraIcon name="clientes" size={19} />}
          to={canSeePatients ? '/pacientes' : undefined}
          loading={patientsLoading}
        />
        <SummaryCard
          label="Taxa de ocupação"
          value="0%"
          hint="sem dados ainda"
          delta="—"
          icon={<AuroraIcon name="clock" size={19} />}
        />
      </AppGrid>

      <Box data-tour="dashboard-week"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: canSeeGoals ? '1.6fr 1fr' : '1fr' },
          gap: { xs: 2, sm: 2.5 },
        }}
      >
        <WeekAgendaCard
          appointments={upcomingThisWeek}
          loading={weekLoading}
          canSeeAgenda={canSeeAgenda}
          onOpen={(a) => {
            setEditingWeekAppt(a);
            setWeekApptDialogOpen(true);
          }}
        />

        {canSeeGoals && <GoalsCard at={goalsAt} />}
      </Box>

      <Box data-tour="dashboard-extras"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', lg: '1fr 1fr 1fr' },
          gap: { xs: 2, sm: 2.5 },
        }}
      >
        {canSeePatients && (
          <BirthdaysCard birthdays={upcomingBirthdays} loading={patientsLoading} onWhatsApp={setWhatsappPatient} />
        )}

        {/* Contas a pagar */}
        {canSeeFinance && <UpcomingExpensesCard embedded />}

        {/* Datas comemorativas */}
        <UpcomingDatesCard embedded />
      </Box>

      {canSeeAgenda && (
        <AppointmentFormDialog
          open={weekApptDialogOpen}
          onClose={() => {
            setWeekApptDialogOpen(false);
            setEditingWeekAppt(null);
          }}
          appointment={editingWeekAppt}
          defaultStart={null}
        />
      )}

      {canSeePatients && (
        <SendWhatsAppDialog
          open={!!whatsappPatient}
          onClose={() => setWhatsappPatient(null)}
          phone={whatsappPatient?.phone}
          patientId={whatsappPatient?.id}
          vars={{ paciente_nome: whatsappPatient?.name?.split(' ')[0] }}
          preferredCategory="aniversario"
          title={`Feliz aniversário — ${whatsappPatient?.name ?? ''}`}
        />
      )}
    </Box>
  );
}
