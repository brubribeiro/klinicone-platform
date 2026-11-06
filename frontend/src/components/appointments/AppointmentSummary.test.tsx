import { render, screen } from '@testing-library/react';
import { createTheme } from '@mui/material';
import { describe, expect, it } from 'vitest';

import { agendaCalendarSx } from './agendaCalendarSx';
import {
  AppointmentSummaryBar,
  AppointmentSummaryPanel,
  PromotionPriceLines,
  type AppointmentSummaryData,
} from './AppointmentSummary';

const data: AppointmentSummaryData = {
  patientName: 'Maria Silva',
  serviceLabel: 'Peeling + Limpeza',
  professionalName: 'Dra. Ana',
  dateLabel: '15/01/2030',
  timeLabel: '10:00',
  durationMinutes: 75,
  packageLabel: 'Avulso',
  amount: 350,
  status: 'CONFIRMED',
  blockingMessage: null,
  stockWarning: false,
};

describe('AppointmentSummaryPanel', () => {
  it('resume paciente, atendimento, profissional, horário, pacote, status e valor', () => {
    render(<AppointmentSummaryPanel data={data} />);
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('Peeling + Limpeza')).toBeInTheDocument();
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument();
    expect(screen.getByText('10:00 · 75 min')).toBeInTheDocument();
    expect(screen.getByText('Avulso')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*350,00/)).toBeInTheDocument();
  });

  it('campos vazios mostram os textos padrão e valor zero vira traço', () => {
    render(
      <AppointmentSummaryPanel
        data={{ ...data, patientName: undefined, professionalName: undefined, dateLabel: undefined, status: undefined, amount: 0 }}
      />,
    );
    expect(screen.getByText('Não selecionado')).toBeInTheDocument();
    expect(screen.getByText('Não definido')).toBeInTheDocument();
    expect(screen.getByText('Data ou horário inválidos')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('promoção mostra valor cheio e desconto; alertas de estoque e bloqueio aparecem', () => {
    render(
      <AppointmentSummaryPanel
        data={{
          ...data,
          promotion: { name: 'Dia da Pele', originalPrice: 400, discount: 50 },
          stockWarning: true,
          blockingMessage: 'Profissional indisponível',
        }}
      />,
    );
    expect(screen.getByText('Valor cheio')).toBeInTheDocument();
    expect(screen.getByText('Promoção · Dia da Pele')).toBeInTheDocument();
    expect(screen.getByText(/−R\$\s*50,00/)).toBeInTheDocument();
    expect(screen.getByText('Estoque insuficiente para os materiais deste atendimento.')).toBeInTheDocument();
    expect(screen.getByText('Profissional indisponível')).toBeInTheDocument();
  });

  it('status desconhecido aparece como veio', () => {
    render(<AppointmentSummaryPanel data={{ ...data, status: 'OUTRO' }} />);
    expect(screen.getByText('OUTRO')).toBeInTheDocument();
  });

  it('PromotionPriceLines isolado', () => {
    render(<PromotionPriceLines promotion={{ name: 'X', originalPrice: 100, discount: 10 }} />);
    expect(screen.getByText(/R\$\s*100,00/)).toBeInTheDocument();
  });
});

describe('AppointmentSummaryBar', () => {
  it('versão compacta com valor e promoção', () => {
    render(<AppointmentSummaryBar data={{ ...data, promotion: { name: 'X', originalPrice: 400, discount: 50 } }} />);
    expect(screen.getByText(/Maria Silva/)).toBeInTheDocument();
    expect(screen.getByText('15/01/2030 · 10:00 · Dra. Ana')).toBeInTheDocument();
    expect(screen.getByText(/Promoção −R\$\s*50,00/)).toBeInTheDocument();
  });

  it('prioriza o bloqueio sobre o aviso de estoque e trata dados ausentes', () => {
    const { rerender } = render(
      <AppointmentSummaryBar data={{ ...data, stockWarning: true, blockingMessage: 'Conflito' }} />,
    );
    expect(screen.getByText('Conflito')).toBeInTheDocument();
    rerender(<AppointmentSummaryBar data={{ ...data, stockWarning: true }} />);
    expect(screen.getByText('Estoque insuficiente para os materiais.')).toBeInTheDocument();
    rerender(
      <AppointmentSummaryBar data={{ ...data, patientName: undefined, dateLabel: undefined, professionalName: undefined, amount: 0 }} />,
    );
    expect(screen.getByText(/Paciente não selecionado/)).toBeInTheDocument();
    expect(screen.getByText('Data ou horário inválidos')).toBeInTheDocument();
  });
});

describe('agendaCalendarSx', () => {
  it('gera estilos para tema claro e escuro', () => {
    const light = agendaCalendarSx(createTheme());
    const dark = agendaCalendarSx(createTheme({ palette: { mode: 'dark' } }));
    expect(light).toMatchObject({ flex: 1, minHeight: 0 });
    expect(JSON.stringify(dark)).not.toBe(JSON.stringify(light));
  });
});
