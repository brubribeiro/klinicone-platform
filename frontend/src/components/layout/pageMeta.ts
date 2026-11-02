export interface PageMeta {
  title: string;
  subtitle: string;
  /** Entidade do AuditHistoryDialog aberto pelo relógio do header. */
  auditEntity?: string;
}

const PAGE_META: (PageMeta & { path: string; exact?: boolean })[] = [
  { path: '/', exact: true, title: 'Dashboard', subtitle: 'Visão geral da clínica' },
  { path: '/pendencias', title: 'Central de Pendências', subtitle: 'O que precisa de atenção na clínica', auditEntity: 'PendingTask' },
  { path: '/agenda', title: 'Agenda', subtitle: 'Agendamentos e horários', auditEntity: 'Appointment' },
  { path: '/pacientes', title: 'Pacientes', subtitle: 'Cadastro e histórico dos pacientes', auditEntity: 'Patient' },
  { path: '/horarios', title: 'Horários', subtitle: 'Disponibilidade da equipe' },
  { path: '/procedimentos', title: 'Procedimentos', subtitle: 'Catálogo de procedimentos', auditEntity: 'Procedure' },
  { path: '/rotinas', title: 'Rotinas de skincare', subtitle: 'Produtos e regras usados na anamnese de pele', auditEntity: 'SkincareProduct' },
  { path: '/pacotes', title: 'Pacotes', subtitle: 'Combos de procedimentos e sessões', auditEntity: 'Package' },
  { path: '/promocoes', title: 'Promoções', subtitle: 'Campanhas e descontos sazonais', auditEntity: 'Promotion' },
  { path: '/financeiro', title: 'Financeiro', subtitle: 'Receitas e despesas', auditEntity: 'FinancialEntry' },
  { path: '/despesas-recorrentes', title: 'Despesas recorrentes', subtitle: 'Custos fixos e periódicos', auditEntity: 'RecurringExpense' },
  { path: '/formas-pagamento', title: 'Formas de pagamento', subtitle: 'Métodos de pagamento', auditEntity: 'PaymentMethod' },
  { path: '/estoque', title: 'Estoque', subtitle: 'Produtos e insumos', auditEntity: 'InventoryItem' },
  { path: '/profissionais', title: 'Profissionais', subtitle: 'Equipe que realiza atendimentos' },
  { path: '/usuarios', title: 'Usuários', subtitle: 'Contas e permissões', auditEntity: 'User' },
  { path: '/grupos', title: 'Grupos', subtitle: 'Papéis e permissões', auditEntity: 'Role' },
  { path: '/mensagens', title: 'Mensagens', subtitle: 'Modelos e envios', auditEntity: 'MessageTemplate' },
  { path: '/documentos', title: 'Documentos', subtitle: 'Arquivos e modelos', auditEntity: 'Document' },
  { path: '/equipamentos', title: 'Equipamentos', subtitle: 'Aparelhos e manutenção', auditEntity: 'Equipment' },
  { path: '/metricas', title: 'Métricas', subtitle: 'Indicadores e relatórios' },
  { path: '/metas', title: 'Metas', subtitle: 'Objetivos e progresso da clínica', auditEntity: 'Goal' },
  { path: '/meu-plano', title: 'Meu plano', subtitle: 'Plano da clínica, uso e limites' },
];

export function getPageMeta(pathname: string): PageMeta {
  const match = PAGE_META.find((m) =>
    m.exact ? pathname === m.path : pathname === m.path || pathname.startsWith(`${m.path}/`),
  );
  return match ?? { title: 'Mila Barreto', subtitle: '' };
}

/** No Dashboard, o subtítulo ganha a data de hoje. */
export function pageSubtitleFor(pathname: string, meta: PageMeta): string {
  return pathname === '/'
    ? `${meta.subtitle} · Hoje, ${new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'long',
      }).format(new Date())}`
    : meta.subtitle;
}
