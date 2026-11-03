import { Box, Button, Card, Typography, Link as MuiLink } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import { AuroraIcon } from '../components/AuroraIcon';
import { fontSizes } from '../theme/fontSizes';
import { BRAND_LEGAL_NAME, BRAND_NAME } from '../brand';

const SECTIONS = [
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
];

export function TermsOfUse() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', color: 'text.primary' }}>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: (t) => alpha(t.palette.background.default, 0.85),
          backdropFilter: 'blur(12px)',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: '100%',
            px: { xs: 2, sm: 4 },
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: '11px',
                background: (t) => `linear-gradient(135deg, #22BBAA, ${t.palette.primary.dark})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: (t) => `0 6px 16px -4px ${alpha(t.palette.primary.dark, 0.5)}`,
              }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
              </svg>
            </Box>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: fontSizes['2xl'], letterSpacing: '-0.4px' }}>
              {BRAND_NAME}
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/login"
            variant="outlined"
            startIcon={<AuroraIcon name="chevronLeft" size={16} strokeWidth={2.2} />}
            sx={{
              flexShrink: 0,
              height: 40,
              px: 2,
              borderRadius: '11px',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.secondary',
              fontSize: fontSizes.sm,
              '&:hover': { borderColor: 'primary.main', bgcolor: 'background.paper', color: 'primary.main' },
            }}
          >
            Voltar ao login
          </Button>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          width: '100%',
          px: { xs: 2, sm: 4 },
          pt: { xs: 4, sm: 6 },
          pb: { xs: 6, sm: 10 },
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: fontSizes.xs,
            fontWeight: 800,
            color: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
            border: '1px solid',
            borderColor: (t) => alpha(t.palette.primary.main, 0.17),
            px: 1.625,
            py: 0.75,
            borderRadius: '8px',
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            mb: 2.5,
          }}
        >
          Documento legal
        </Box>
        <Typography
          component="h1"
          sx={{ m: 0, mb: 1.5, fontSize: { xs: fontSizes['6xl'], sm: fontSizes['7xl'] }, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.2 }}
        >
          Termos de Uso
        </Typography>
        <Typography sx={{ mb: { xs: 3, sm: 5 }, fontSize: fontSizes.md, color: 'text.secondary', fontWeight: 500 }}>
          Última atualização: Novembro de 2026
        </Typography>

        <Card sx={{ borderRadius: '20px', px: { xs: 2.5, sm: 5.5 }, py: { xs: 3, sm: 5 } }}>
          {SECTIONS.map((section, i) => (
            <Box key={section.title} sx={{ mb: i === SECTIONS.length - 1 ? 0 : 3.5 }}>
              <Typography
                component="h2"
                sx={{ mb: 1.5, fontSize: fontSizes['2xl'], fontWeight: 800, letterSpacing: '-0.3px' }}
              >
                {section.title}
              </Typography>
              <Typography sx={{ fontSize: fontSizes.lg, lineHeight: 1.7, color: 'grey.700' }}>{section.body}</Typography>
            </Box>
          ))}
        </Card>

        <Typography sx={{ mt: 4, textAlign: 'center', fontSize: fontSizes.sm, color: 'text.disabled', fontWeight: 500 }}>
          © {new Date().getFullYear()} {BRAND_NAME} ·{' '}
          <MuiLink
            component={Link}
            to="/privacidade"
            underline="none"
            sx={{ color: 'text.secondary', fontWeight: 700, '&:hover': { color: 'primary.main' } }}
          >
            Política de Privacidade
          </MuiLink>
        </Typography>
      </Box>
    </Box>
  );
}
