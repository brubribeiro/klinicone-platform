import type { AuroraIconName } from '../../../../frontend/src/components/AuroraIcon';

/**
 * Textos da landing de divulgação (`/`), num só lugar.
 * Manter alinhado a `frontend/src/brand.ts` e ao <title>/og:* de `apps/landing/index.html`.
 */
export { BRAND_NAME, BRAND_TAGLINE } from '../../../../frontend/src/brand';

export const HERO = {
  eyebrow: 'Plataforma para clínicas de estética e saúde',
  title: 'Sua clínica organizada, do agendamento ao financeiro.',
  subtitle:
    'Agenda, prontuário, procedimentos, estoque e financeiro conectados em um só lugar — para a equipe atender melhor e a gestão decidir com números.',
};

export const BENEFITS: { icon: AuroraIconName; title: string; text: string }[] = [
  {
    icon: 'agenda',
    title: 'Agenda organizada',
    text: 'Expediente de cada profissional, bloqueios e status de cada atendimento à vista.',
  },
  {
    icon: 'clientes',
    title: 'Histórico completo da paciente',
    text: 'Anamnese, fotos de antes e depois, documentos assinados e evolução em uma ficha só.',
  },
  {
    icon: 'financeiro',
    title: 'Financeiro com clareza',
    text: 'Entradas, despesas recorrentes, formas de pagamento e custo por hora de cada procedimento.',
  },
  {
    icon: 'lock',
    title: 'Dados protegidos',
    text: 'Cada clínica com seus dados isolados, permissões por grupo e registro de quem alterou o quê.',
  },
];

/** Módulo com vídeo curto do painel (`public/videos/<video>.mp4` e `.jpg`, gravados com dados fictícios). */
export interface LandingModule {
  id: string;
  icon: AuroraIconName;
  title: string;
  text: string;
  points: string[];
  video: string;
}

export const MODULES: LandingModule[] = [
  {
    id: 'agenda',
    icon: 'agenda',
    title: 'Agenda',
    text: 'A agenda de todas as profissionais em uma tela, por dia, semana ou mês.',
    points: [
      'Vários procedimentos no mesmo agendamento',
      'Bloqueios, feriados e expediente de cada profissional',
      'Mapa de aplicação com pontos e doses no atendimento',
      'Cores por status e aviso de atendimentos sem status',
    ],
    video: 'agenda',
  },
  {
    id: 'pacientes',
    icon: 'clientes',
    title: 'Pacientes e ficha',
    text: 'Tudo sobre cada paciente em uma ficha só, sem papel e sem pastas soltas.',
    points: [
      'Anamnese, medidas corporais, fotos e documentos na mesma ficha',
      'Histórico de agendamentos, pacotes e pagamentos',
      'Busca por nome, CPF ou telefone e WhatsApp a um clique',
    ],
    video: 'pacientes',
  },
  {
    id: 'financeiro',
    icon: 'financeiro',
    title: 'Financeiro',
    text: 'Receitas, despesas e lucro do período, para decidir com números e não no achismo.',
    points: [
      'Lançamentos, notas fiscais pendentes e exportação do período',
      'Despesas recorrentes e formas de pagamento',
      'Custo por hora de cada procedimento',
    ],
    video: 'financeiro',
  },
  {
    id: 'pacotes',
    icon: 'pacotes',
    title: 'Pacotes e promoções',
    text: 'Venda sessões em pacote e crie campanhas com desconto sem fazer conta à mão.',
    points: [
      'Pacotes com procedimentos, sessões e preço especial',
      'Sessões do pacote acompanhadas na ficha da paciente',
      'Promoções com desconto e data de início e fim',
    ],
    video: 'pacotes',
  },
  {
    id: 'estoque',
    icon: 'estoque',
    title: 'Estoque',
    text: 'Saiba o que tem na clínica antes de faltar produto no meio do atendimento.',
    points: [
      'Entradas e saídas com histórico por produto',
      'Alerta de itens abaixo do estoque mínimo',
      'Produtos e materiais com unidade de medida',
    ],
    video: 'estoque',
  },
  {
    id: 'mensagens',
    icon: 'mensagens',
    title: 'Mensagens e WhatsApp',
    text: 'Modelos de texto prontos para falar com as pacientes pelo WhatsApp em segundos.',
    points: [
      'Modelos com variáveis, como o nome da paciente',
      'Mensagens prontas na marcação, na véspera, no aniversário e após o atendimento',
      'Abre a conversa no WhatsApp com o texto preenchido',
    ],
    video: 'mensagens',
  },
  {
    id: 'documentos',
    icon: 'documentos',
    title: 'Documentos',
    text: 'Termos, contratos e arquivos da clínica guardados com segurança e fáceis de achar.',
    points: [
      'Documentos vinculados à paciente',
      'Busca e filtros para encontrar qualquer arquivo',
      'Visualizar e baixar sem sair da plataforma',
    ],
    video: 'documentos',
  },
  {
    id: 'rotinas',
    icon: 'rotinas',
    title: 'Rotinas de skincare',
    text: 'Da anamnese de pele à rotina pronta para a paciente seguir em casa.',
    points: [
      'Anamnese de pele guiada, pergunta a pergunta',
      'Regras da clínica sugerem os produtos de cada etapa',
      'Rotina enviada à paciente por WhatsApp ou e-mail',
    ],
    video: 'rotinas',
  },
  {
    id: 'metas',
    icon: 'metas',
    title: 'Metas',
    text: 'Defina objetivos para a clínica e acompanhe o andamento ao longo do mês.',
    points: [
      'Metas com valor e período',
      'Progresso de cada meta e resumo das atingidas',
      'Andamento das metas também no painel inicial',
    ],
    video: 'metas',
  },
  {
    id: 'tour',
    icon: 'help',
    title: 'Tour guiado',
    text: 'A equipe aprende a usar sozinha: cada tela explica a si mesma em poucos passos.',
    points: [
      'O tour abre na primeira visita a cada tela',
      'Botão “Como funciona?” para rever quando quiser',
      'Menos tempo treinando quem chega na equipe',
    ],
    video: 'tour',
  },
];

/** Demais módulos, sem vídeo. */
export const MORE_FEATURES: { icon: AuroraIconName; title: string; text: string }[] = [
  { icon: 'dashboard', title: 'Painel inicial', text: 'Indicadores do dia, agenda da semana e lembretes.' },
  { icon: 'procedimentos', title: 'Procedimentos', text: 'Catálogo com duração, preço, insumos e custo.' },
  { icon: 'horarios', title: 'Horários', text: 'Dias de atendimento e ausências de cada profissional.' },
  { icon: 'equipamentos', title: 'Equipamentos', text: 'Aparelhos da clínica e o status de cada um.' },
  { icon: 'relatorios', title: 'Métricas', text: 'Indicadores do período comparados ao anterior, com exportação.' },
  { icon: 'permissoes', title: 'Equipe e permissões', text: 'Cada pessoa vê e edita só o que o grupo dela permite.' },
];

export const STEPS: { title: string; text: string }[] = [
  { title: 'Fale com a gente', text: 'Conte como a clínica funciona hoje: quantas profissionais, quais serviços e o que mais toma tempo.' },
  { title: 'Escolha o plano', text: 'Indicamos o plano com os módulos que fazem sentido para o tamanho da sua clínica.' },
  { title: 'Clínica pronta', text: 'Preparamos a clínica na plataforma e os acessos da equipe. Nada para instalar.' },
  { title: 'Equipe atendendo', text: 'Cada pessoa entra com a conta Google e o tour guiado mostra como usar cada tela.' },
];

export const AUDIENCE: { icon: AuroraIconName; title: string; text: string }[] = [
  {
    icon: 'profissionais',
    title: 'Profissional autônoma',
    text: 'Quem atende sozinha e quer agenda, fichas e financeiro organizados sem planilha.',
  },
  {
    icon: 'clientes',
    title: 'Clínicas com equipe',
    text: 'Várias profissionais e salas na mesma agenda, cada uma com o acesso que precisa.',
  },
  {
    icon: 'rotinas',
    title: 'Estética facial e corporal',
    text: 'Anamnese, fotos de evolução, pacotes de sessões e rotinas de skincare.',
  },
  {
    icon: 'dashboard',
    title: 'Gestão da clínica',
    text: 'Quem cuida do negócio e precisa de números claros: faturamento, despesas e metas.',
  },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. A plataforma funciona no navegador, no computador e no celular.',
  },
  {
    q: 'Como a equipe acessa?',
    a: 'Cada pessoa entra com a própria conta Google, cadastrada pela clínica. O que cada uma vê e edita depende do grupo de permissões.',
  },
  {
    q: 'Serve para a minha clínica?',
    a: 'Foi feita para clínicas de estética e saúde de qualquer tamanho: de quem atende sozinha a equipes com várias profissionais e salas.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Os dados de cada clínica ficam isolados dos das outras, o acesso é controlado por permissões e as alterações importantes ficam registradas.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim. As telas se ajustam ao celular e ao tablet, então dá para consultar a agenda e a ficha da paciente entre um atendimento e outro.',
  },
  {
    q: 'A equipe precisa de treinamento?',
    a: 'Cada tela tem um tour guiado que abre na primeira visita e pode ser revisto no botão “Como funciona?”. Assim quem chega na equipe aprende no próprio uso.',
  },
  {
    q: 'Consigo mandar mensagens pelo WhatsApp?',
    a: 'Sim. A plataforma tem modelos de mensagem com o nome da paciente e outras variáveis, e abre a conversa no WhatsApp pronta para enviar.',
  },
  {
    q: 'Posso trocar de plano depois?',
    a: 'Sim. Em “Meu plano”, dentro da plataforma, a clínica pede mais limites, novos módulos ou outro plano à nossa equipe.',
  },
  {
    q: 'Como faço para contratar?',
    a: 'Fale com a gente: escolhemos o plano com você e preparamos a clínica e os acessos da equipe. Ainda não há pagamento online.',
  },
];
