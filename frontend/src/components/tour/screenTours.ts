import type { TourStep } from './GuidedTour';

export interface ScreenTour {
  /** Chave da tela na persistência (por usuário). */
  key: string;
  path: string;
  steps: TourStep[];
}

// Último passo de todos os tours: aponta o botão do header que reabre o tour.
const HELP_STEP: TourStep = {
  target: 'tour-help',
  title: 'Ver de novo',
  body: 'Esqueceu algum passo? Toque em “Como funciona?” para rever este tour quando quiser.',
};

/**
 * Tours por tela, exibidos na primeira visita. `target` é o `data-tour` do elemento;
 * passos cujo elemento não está na tela (sem permissão, sem dados) são pulados.
 */
const SCREEN_TOURS: ScreenTour[] = [
  {
    key: 'agenda',
    path: '/agenda',
    steps: [
      {
        title: 'Sua agenda',
        body: 'Aqui ficam os agendamentos, feriados e bloqueios de horário dos profissionais. Veja o básico em poucos passos.',
      },
      {
        target: 'agenda-new',
        title: 'Novo agendamento',
        body: 'Crie um agendamento por aqui, de qualquer tela. Na agenda, também dá para clicar num horário livre.',
      },
      {
        target: 'agenda-pending',
        title: 'Agendamentos pendentes',
        body: 'Atendimentos que já passaram e ainda esperam um status aparecem aqui. Abra cada um para concluir.',
      },
      {
        target: 'agenda-toolbar',
        title: 'Navegue pelo período',
        body: 'Use as setas e “Hoje” para mudar a data e alterne entre Dia, Semana e Mês.',
      },
      {
        target: 'agenda-legend',
        title: 'Cores dos status',
        body: 'Cada cor indica o status do agendamento: confirmado, concluído, cancelado e os demais.',
      },
      {
        target: 'agenda-calendar',
        title: 'Calendário',
        body: 'Clique num agendamento para ver os detalhes, remarcar ou mudar o status. Horários bloqueados não aceitam novos agendamentos.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'pacientes',
    path: '/pacientes',
    steps: [
      {
        title: 'Pacientes',
        body: 'Cadastro, histórico e anamnese de cada paciente da clínica, num só lugar.',
      },
      {
        target: 'patients-stats',
        title: 'Resumo',
        body: 'Total de pacientes, ativos nos últimos 90 dias, novos no mês e ticket médio.',
      },
      {
        target: 'patients-list',
        title: 'Lista de pacientes',
        body: 'Busque por nome, CPF ou telefone e ordene pelas colunas. Clique numa linha para abrir a ficha; pelos ícones dela você manda WhatsApp e preenche a anamnese.',
      },
      {
        target: 'patients-new',
        title: 'Adicionar paciente',
        body: 'Cadastre um novo paciente com dados de contato e documentos.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'financeiro',
    path: '/financeiro',
    steps: [
      {
        title: 'Financeiro',
        body: 'Receitas e despesas da clínica no período escolhido.',
      },
      {
        target: 'finance-period',
        title: 'Período e lançamentos',
        body: 'Escolha as datas “De” e “Até”: tudo na tela segue esse período. Registre receitas e despesas em “Novo lançamento”.',
      },
      {
        target: 'finance-kpis',
        title: 'Indicadores',
        body: 'Receitas, despesas, lucro e notas pendentes do período. Clique em “Notas pendentes” para filtrar a lista.',
      },
      {
        target: 'finance-transactions',
        title: 'Transações',
        body: 'Busque, filtre por tipo ou nota fiscal e exporte o período. O olho no topo esconde os valores da tela.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'dashboard',
    path: '/',
    steps: [
      {
        title: 'Painel da clínica',
        body: 'Um resumo do dia a dia: indicadores, agenda da semana e avisos importantes.',
      },
      {
        target: 'dashboard-summary',
        title: 'Indicadores',
        body: 'Faturamento, agendamentos de hoje, novos pacientes e mais. Clique num card para abrir a tela correspondente.',
      },
      {
        target: 'dashboard-week',
        title: 'Agenda da semana',
        body: 'Próximos atendimentos e, ao lado, o andamento das metas. Clique num atendimento para abrir.',
      },
      {
        target: 'dashboard-extras',
        title: 'Lembretes',
        body: 'Aniversariantes, contas a pagar e datas comemorativas para você não esquecer de nada.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'documentos',
    path: '/documentos',
    steps: [
      {
        title: 'Documentos',
        body: 'Termos, contratos e arquivos da clínica ou dos pacientes, guardados com segurança.',
      },
      {
        target: 'documents-list',
        title: 'Lista de documentos',
        body: 'Busque, filtre e abra os arquivos. Use os ícones de cada linha para visualizar, baixar ou excluir.',
      },
      {
        target: 'documents-new',
        title: 'Novo documento',
        body: 'Envie um arquivo e vincule a um paciente, se quiser.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'mensagens',
    path: '/mensagens',
    steps: [
      {
        title: 'Mensagens',
        body: 'Modelos de texto prontos para enviar aos pacientes por WhatsApp.',
      },
      {
        target: 'messages-list',
        title: 'Modelos',
        body: 'Escolha um modelo da lista para ver o texto completo ao lado.',
      },
      {
        target: 'messages-new',
        title: 'Novo modelo',
        body: 'Crie um modelo usando variáveis, como o nome do paciente, que são preenchidas no envio.',
      },
      {
        target: 'messages-detail',
        title: 'Detalhe do modelo',
        body: 'Veja a prévia e edite o modelo selecionado.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'estoque',
    path: '/estoque',
    steps: [
      {
        title: 'Estoque',
        body: 'Controle de produtos e materiais, com alerta de itens abaixo do mínimo.',
      },
      {
        target: 'inventory-list',
        title: 'Produtos',
        body: 'Busque e ordene os produtos; clique num item para ver o histórico de movimentações.',
      },
      {
        target: 'inventory-new',
        title: 'Cadastrar produto',
        body: 'Registre um novo produto com estoque mínimo e unidade.',
      },
      {
        target: 'inventory-move',
        title: 'Movimentar',
        body: 'Dê entrada ou saída de estoque de um produto.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'equipamentos',
    path: '/equipamentos',
    steps: [
      {
        title: 'Equipamentos',
        body: 'Cadastro dos aparelhos da clínica e do status de cada um.',
      },
      {
        target: 'equipment-list',
        title: 'Seus equipamentos',
        body: 'Cada cartão mostra um equipamento; use os botões dele para editar ou inativar.',
      },
      {
        target: 'equipment-new',
        title: 'Novo equipamento',
        body: 'Cadastre um aparelho novo.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'metas',
    path: '/metas',
    steps: [
      {
        title: 'Metas',
        body: 'Defina objetivos para a clínica e acompanhe o progresso.',
      },
      {
        target: 'goals-summary',
        title: 'Resumo',
        body: 'Quantas metas estão em andamento, atingidas e o desempenho geral.',
      },
      {
        target: 'goals-list',
        title: 'Suas metas',
        body: 'Cada meta mostra o quanto já foi atingido. Edite pelos ícones do cartão.',
      },
      {
        target: 'goals-new',
        title: 'Nova meta',
        body: 'Crie uma meta com valor e período.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'metricas',
    path: '/metricas',
    steps: [
      {
        title: 'Métricas',
        body: 'Indicadores de desempenho da clínica em um período.',
      },
      {
        target: 'metrics-kpis',
        title: 'Resumo do período',
        body: 'Principais números, comparados ao período anterior.',
      },
      {
        target: 'metrics-tabs',
        title: 'Abas e exportação',
        body: 'Troque entre agendamentos, pacientes, procedimentos, pacotes e financeiro, e exporte os dados em CSV.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'procedimentos',
    path: '/procedimentos',
    steps: [
      {
        title: 'Procedimentos',
        body: 'O catálogo de serviços da clínica, com preço, duração e custo.',
      },
      {
        target: 'procedures-list',
        title: 'Lista de procedimentos',
        body: 'Busque pelo nome e use os ícones de cada linha para editar ou desativar.',
      },
      {
        target: 'procedures-new',
        title: 'Novo procedimento',
        body: 'Cadastre um serviço novo para usá-lo na agenda e no financeiro.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'pacotes',
    path: '/pacotes',
    steps: [
      {
        title: 'Pacotes',
        body: 'Combine procedimentos em pacotes com sessões e preço especial.',
      },
      {
        target: 'packages-new',
        title: 'Novo pacote',
        body: 'Monte um pacote escolhendo os procedimentos e o valor.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'promocoes',
    path: '/promocoes',
    steps: [
      {
        title: 'Promoções',
        body: 'Descontos com data de início e fim para atrair pacientes.',
      },
      {
        target: 'promotions-new',
        title: 'Nova promoção',
        body: 'Crie uma promoção e defina o período e o desconto.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'usuarios',
    path: '/usuarios',
    steps: [
      {
        title: 'Usuários',
        body: 'Quem acessa o sistema da clínica e com qual perfil de permissão.',
      },
      {
        target: 'users-list',
        title: 'Equipe',
        body: 'Busque usuários, altere o perfil e ative ou desative o acesso pelos ícones da linha.',
      },
      {
        target: 'users-new',
        title: 'Novo usuário',
        body: 'Convide alguém da equipe e escolha o perfil dele.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'horarios',
    path: '/horarios',
    steps: [
      {
        title: 'Horários',
        body: 'Defina quando cada profissional atende e registre ausências.',
      },
      {
        target: 'hours-team',
        title: 'Disponibilidade',
        body: 'Veja e edite os dias e horários de trabalho de cada profissional.',
      },
      {
        target: 'hours-blocks',
        title: 'Bloqueios',
        body: 'Registre férias, folgas e outros períodos em que não há atendimento.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'despesas',
    path: '/despesas-recorrentes',
    steps: [
      {
        title: 'Despesas recorrentes',
        body: 'Contas fixas que se repetem todo mês, como aluguel e assinaturas.',
      },
      {
        target: 'expenses-list',
        title: 'Lista de despesas',
        body: 'Busque por despesa ou categoria e edite pelos ícones da linha.',
      },
      {
        target: 'expenses-generate',
        title: 'Gerar lançamentos',
        body: 'Cria no Financeiro os lançamentos do mês a partir das despesas cadastradas.',
      },
      {
        target: 'expenses-new',
        title: 'Nova despesa',
        body: 'Cadastre uma conta fixa com valor e dia de vencimento.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'formas-pagamento',
    path: '/formas-pagamento',
    steps: [
      {
        title: 'Formas de pagamento',
        body: 'Métodos aceitos pela clínica e suas taxas.',
      },
      {
        target: 'payments-new',
        title: 'Novo método',
        body: 'Cadastre uma forma de pagamento, como cartão ou Pix, com a taxa cobrada.',
      },
      HELP_STEP,
    ],
  },
  {
    key: 'meu-plano',
    path: '/meu-plano',
    steps: [
      {
        title: 'Meu plano',
        body: 'O plano contratado pela clínica, os limites e os módulos liberados.',
      },
      {
        target: 'plan-current',
        title: 'Plano atual',
        body: 'Nome do plano e situação da assinatura.',
      },
      HELP_STEP,
    ],
  },
];

export function getScreenTour(pathname: string): ScreenTour | undefined {
  return SCREEN_TOURS.find((t) => pathname === t.path);
}
