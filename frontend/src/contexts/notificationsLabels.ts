import type { NotificationType } from '../types';

export const NOTIFICATION_TYPES: {
  type: NotificationType;
  label: string;
  description: string;
}[] = [
  {
    type: 'APPOINTMENT_CREATED',
    label: 'Novo agendamento',
    description: 'Receba quando um agendamento for criado para você',
  },
  {
    type: 'APPOINTMENT_CANCELLED',
    label: 'Agendamento cancelado',
    description: 'Receba quando um agendamento for cancelado',
  },
  {
    type: 'INVENTORY_LOW_STOCK',
    label: 'Estoque baixo',
    description: 'Receba quando um item chegar ao estoque mínimo',
  },
  {
    type: 'INVENTORY_EXPIRING',
    label: 'Produto vencendo',
    description: 'Receba quando um produto do estoque estiver próximo da validade',
  },
  {
    type: 'PATIENT_CREATED',
    label: 'Novo paciente cadastrado',
    description: 'Receba quando um novo paciente entrar no sistema',
  },
  {
    type: 'PATIENT_RETURN_DUE',
    label: 'Retorno pendente',
    description: 'Receba quando um paciente tiver retorno vencido (baseado no procedimento)',
  },
  {
    type: 'PATIENT_REACTIVATION',
    label: 'Reativação de paciente',
    description: 'Receba quando um paciente não retorna há mais de 3 meses',
  },
  {
    type: 'USER_CREATED',
    label: 'Novo profissional cadastrado',
    description: 'Receba quando um novo usuário for adicionado à plataforma',
  },
  {
    type: 'EQUIPMENT_MAINTENANCE',
    label: 'Manutenção de equipamento',
    description: 'Receba quando um equipamento estiver com manutenção próxima',
  },
  {
    type: 'PLATFORM_ANNOUNCEMENT',
    label: 'Novidades da plataforma',
    description: 'Receba avisos de novas funcionalidades e correções do sistema',
  },
  {
    type: 'FEEDBACK_CLOSED',
    label: 'Feedback concluído',
    description: 'Receba quando um bug ou sugestão que você enviou for finalizado pela plataforma',
  },
];

export function labelForType(type: NotificationType): string {
  return NOTIFICATION_TYPES.find((t) => t.type === type)?.label ?? type;
}
