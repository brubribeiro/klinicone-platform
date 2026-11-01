import type { AuroraIconName } from '../../../../frontend/src/components/AuroraIcon';

/**
 * Textos da landing de divulgação (`/`), num só lugar para a Bruna revisar.
 * O nome da aplicação ainda não foi escolhido: BRAND_NAME é provisório
 * (trocar também o <title> e as metas og:* de frontend/index.html).
 */
export const BRAND_NAME = 'Aurora';
export const BRAND_TAGLINE = 'Gestão para clínicas';

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

export const FEATURES: { icon: AuroraIconName; title: string; text: string }[] = [
  { icon: 'agenda', title: 'Agenda', text: 'Visão por dia, semana e mês, com status de cada atendimento.' },
  { icon: 'clientes', title: 'Pacientes', text: 'Ficha, anamnese, medidas corporais e fotos de evolução.' },
  { icon: 'procedimentos', title: 'Procedimentos', text: 'Catálogo com duração, preço, insumos e mapa de aplicação.' },
  { icon: 'pacotes', title: 'Pacotes e promoções', text: 'Sessões vendidas em pacote e campanhas com desconto.' },
  { icon: 'financeiro', title: 'Financeiro', text: 'Lançamentos, parcelas, despesas recorrentes e custo/hora.' },
  { icon: 'estoque', title: 'Estoque', text: 'Entradas, saídas e alerta de produtos acabando.' },
  { icon: 'rotinas', title: 'Rotinas de skincare', text: 'Rotinas personalizadas enviadas para a paciente.' },
  { icon: 'mensagens', title: 'Mensagens', text: 'Lembretes e aniversários prontos para enviar pelo WhatsApp.' },
  { icon: 'documentos', title: 'Documentos', text: 'Termos de consentimento e autorizações a partir de modelos.' },
  { icon: 'relatorios', title: 'Métricas e metas', text: 'Faturamento, ticket médio e metas do mês em gráficos.' },
  { icon: 'equipamentos', title: 'Equipamentos', text: 'Aparelhos da clínica ligados aos procedimentos que os usam.' },
  { icon: 'permissoes', title: 'Equipe e permissões', text: 'Cada profissional vê só o que o grupo dela permite.' },
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
    q: 'Como faço para contratar?',
    a: 'Fale com a gente: escolhemos o plano com você e preparamos a clínica e os acessos da equipe. Ainda não há pagamento online.',
  },
];
