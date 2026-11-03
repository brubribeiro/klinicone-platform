import { BRAND_LEGAL_NAME } from '../brand';

/** Fonte única do texto dos Termos de Uso (painel e landing). */
export const TERMS_SECTIONS = [
  {
    title: '1. Aceitação dos Termos',
    body: `Ao acessar e utilizar a plataforma ${BRAND_LEGAL_NAME} ("Plataforma"), você concorda com estes Termos de Uso. O acesso é restrito a profissionais previamente cadastrados pela administração da clínica. Caso não concorde com qualquer condição apresentada, não utilize a Plataforma.`,
  },
  {
    title: '2. Descrição do Serviço',
    body: `A Plataforma é um software de gestão (SaaS) oferecido pela ${BRAND_LEGAL_NAME} para clínicas de estética e saúde, que permite o gerenciamento de agendamentos, cadastro de pacientes, prontuários, procedimentos, controle financeiro, estoque, equipamentos e demais funcionalidades operacionais da clínica.`,
  },
  {
    title: '3. Acesso e Autenticação',
    body: 'O acesso à Plataforma é realizado exclusivamente por autenticação via conta Google. Apenas profissionais cujo e-mail esteja previamente cadastrado no sistema terão acesso. O usuário é responsável por manter a segurança de sua conta Google e por todas as atividades realizadas sob sua autenticação.',
  },
  {
    title: '4. Obrigações do Usuário',
    body: 'O usuário se compromete a: (a) utilizar a Plataforma exclusivamente para fins profissionais relacionados às atividades da clínica; (b) não compartilhar seu acesso com terceiros; (c) tratar os dados de pacientes com sigilo e em conformidade com a legislação vigente, especialmente a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018); (d) não tentar acessar áreas ou funcionalidades para as quais não possua permissão; (e) reportar imediatamente qualquer uso não autorizado ou suspeita de violação de segurança.',
  },
  {
    title: '5. Dados de Pacientes e Confidencialidade',
    body: 'A Plataforma armazena dados pessoais e dados sensíveis de saúde dos pacientes, incluindo nome, CPF, telefone, endereço, histórico de procedimentos, prontuários e fotografias. O usuário reconhece que esses dados são confidenciais e protegidos por lei, comprometendo-se a não divulgá-los, copiá-los ou utilizá-los para qualquer finalidade que não seja o atendimento ao paciente dentro do escopo da clínica.',
  },
  {
    title: '6. Propriedade Intelectual',
    body: `Todos os direitos de propriedade intelectual relativos à Plataforma, incluindo código-fonte, design, marca e conteúdo, pertencem à ${BRAND_LEGAL_NAME}. O acesso concedido ao usuário não implica transferência de qualquer direito de propriedade.`,
  },
  {
    title: '7. Disponibilidade e Manutenção',
    body: `A ${BRAND_LEGAL_NAME} empenha-se em manter a Plataforma disponível, porém não garante acesso ininterrupto. Manutenções programadas ou emergenciais podem ocasionar indisponibilidade temporária. A ${BRAND_LEGAL_NAME} não se responsabiliza por danos decorrentes de interrupções no serviço.`,
  },
  {
    title: '8. Limitação de Responsabilidade',
    body: `A Plataforma é fornecida "como está". A ${BRAND_LEGAL_NAME} não se responsabiliza por decisões clínicas tomadas com base nas informações exibidas na Plataforma. O profissional é o único responsável por seus atos clínicos e pela verificação dos dados antes de qualquer procedimento.`,
  },
  {
    title: '9. Suspensão e Revogação de Acesso',
    body: 'A administração da clínica reserva-se o direito de suspender ou revogar o acesso de qualquer usuário, a qualquer momento, em caso de descumprimento destes Termos, desligamento do profissional ou por qualquer outro motivo justificado.',
  },
  {
    title: '10. Alterações nos Termos',
    body: 'Estes Termos podem ser atualizados a qualquer momento. O uso continuado da Plataforma após alterações constitui aceitação dos novos termos. Alterações relevantes serão comunicadas aos usuários.',
  },
  {
    title: '11. Legislação Aplicável',
    body: 'Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de São Paulo - SP para dirimir quaisquer controvérsias.',
  },
  {
    title: '12. Contato',
    body: `Em caso de dúvidas sobre estes Termos, entre em contato com a equipe da ${BRAND_LEGAL_NAME}.`,
  },
] as const;

export const TERMS_LAST_UPDATED = 'Novembro de 2026';
