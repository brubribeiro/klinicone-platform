import { ReactNode } from 'react';
import { Box, Typography, Link as MuiLink, alpha } from '@mui/material';
import { Link } from 'react-router-dom';
import { AuroraIcon } from '../components/AuroraIcon';
import { fontSizes } from '../theme/fontSizes';
import { BRAND_LEGAL_NAME, BRAND_NAME } from '../brand';
const CONTENT_SX = { width: '100%', px: { xs: 2.5, sm: 4 } };

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="h2"
      sx={{ mb: 1.5, fontSize: fontSizes['2xl'], fontWeight: 800, letterSpacing: '-0.3px', color: 'text.primary' }}
    >
      {children}
    </Typography>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="p"
      sx={{
        mb: 3.5,
        fontSize: fontSizes.lg,
        lineHeight: 1.7,
        color: 'grey.700',
        '&:last-child': { mb: 0 },
        '& strong': { color: 'text.primary', fontWeight: 700 },
      }}
    >
      {children}
    </Typography>
  );
}

export function PrivacyPolicy() {
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
            ...CONTENT_SX,
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
                borderRadius: '11px',
                background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
                boxShadow: '0 6px 16px -4px rgba(15,124,123,.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
              </svg>
            </Box>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: fontSizes['2xl'], letterSpacing: '-0.4px' }}>
              {BRAND_NAME}
            </Typography>
          </Box>
          <MuiLink
            component={Link}
            to="/login"
            underline="none"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              height: 40,
              px: 2,
              borderRadius: '11px',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.secondary',
              fontSize: fontSizes.sm,
              fontWeight: 700,
              '&:hover': { borderColor: 'primary.main', color: 'primary.dark' },
            }}
          >
            <AuroraIcon name="chevronLeft" size={16} strokeWidth={2.2} />
            Voltar ao login
          </MuiLink>
        </Box>
      </Box>

      <Box component="main" sx={{ ...CONTENT_SX, pt: { xs: 4, sm: 6 }, pb: { xs: 6, sm: 10 } }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            mb: 2.5,
            px: 1.625,
            py: 0.75,
            borderRadius: '8px',
            border: 1,
            borderColor: (t) => alpha(t.palette.primary.main, 0.17),
            bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
            color: 'primary.main',
            fontSize: fontSizes.xs,
            fontWeight: 800,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
          }}
        >
          Documento legal
        </Box>
        <Typography
          component="h1"
          sx={{ mb: 1.5, fontSize: { xs: fontSizes['6xl'], sm: '2.25rem' }, fontWeight: 800, letterSpacing: '-1px' }}
        >
          Política de Privacidade
        </Typography>
        <Typography sx={{ mb: { xs: 3, sm: 5 }, fontSize: fontSizes.md, fontWeight: 500, color: 'text.secondary' }}>
          Última atualização: Junho de 2026
        </Typography>

        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: '20px',
            px: { xs: 2.5, sm: 5.5 },
            py: { xs: 3, sm: 5 },
            boxShadow: '0 1px 2px rgba(16,40,37,.04),0 8px 24px -12px rgba(16,40,37,.10)',
          }}
        >
          <SectionTitle>
            1. Introdução
          </SectionTitle>
          <Paragraph>
            A {BRAND_LEGAL_NAME} ("nós", "nosso") é responsável pelo tratamento dos dados pessoais
            coletados por meio desta plataforma de gestão SaaS para clínicas ("Plataforma"). Esta Política
            de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos seus dados, em
            conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018). Cada clínica
            contratante permanece controladora dos dados de suas pacientes no uso diário da Plataforma.
          </Paragraph>

          <SectionTitle>
            2. Dados Coletados
          </SectionTitle>
          <Paragraph>
            <strong>Dados dos profissionais (usuários da Plataforma):</strong> nome, endereço de
            e-mail (obtido via autenticação Google), função/cargo na clínica e registro de atividades
            na Plataforma.
          </Paragraph>
          <Paragraph>
            <strong>Dados dos pacientes (cadastrados pelos profissionais):</strong> nome completo,
            CPF, data de nascimento, telefone, endereço, e-mail, histórico de procedimentos
            realizados, prontuários clínicos, fotografias (antes/depois), informações financeiras
            referentes a pagamentos e dados de saúde relevantes ao atendimento estético.
          </Paragraph>

          <SectionTitle>
            3. Finalidade do Tratamento
          </SectionTitle>
          <Paragraph>
            Os dados são tratados para as seguintes finalidades: (a) gestão de agendamentos e
            atendimentos da clínica; (b) manutenção de prontuários e histórico clínico dos pacientes;
            (c) controle financeiro e faturamento; (d) gestão de estoque e equipamentos; (e)
            comunicação com pacientes (lembretes, confirmações); (f) geração de relatórios e métricas
            operacionais internas; (g) cumprimento de obrigações legais e regulatórias.
          </Paragraph>

          <SectionTitle>
            4. Base Legal
          </SectionTitle>
          <Paragraph>
            O tratamento dos dados pessoais é realizado com base nas seguintes hipóteses legais
            previstas na LGPD: (a) execução de contrato ou procedimentos preliminares (Art. 7º, V);
            (b) cumprimento de obrigação legal ou regulatória (Art. 7º, II); (c) tutela da saúde, em
            procedimento realizado por profissionais de saúde (Art. 7º, VIII); (d) legítimo interesse
            do controlador para gestão interna da clínica (Art. 7º, IX). Para dados sensíveis de
            saúde, o tratamento é fundamentado na tutela da saúde (Art. 11, II, f).
          </Paragraph>

          <SectionTitle>
            5. Compartilhamento de Dados
          </SectionTitle>
          <Paragraph>
            Os dados pessoais não são vendidos, alugados ou compartilhados com terceiros para fins
            comerciais. O compartilhamento pode ocorrer nas seguintes situações: (a) com prestadores
            de serviços de tecnologia que hospedam ou mantêm a Plataforma, sob obrigações contratuais
            de sigilo; (b) com o Google, limitado ao processo de autenticação (e-mail e nome do
            usuário); (c) quando exigido por lei, ordem judicial ou autoridade competente.
          </Paragraph>

          <SectionTitle>
            6. Armazenamento e Segurança
          </SectionTitle>
          <Paragraph>
            Os dados são armazenados em servidores protegidos com medidas de segurança técnicas e
            administrativas adequadas, incluindo: criptografia em trânsito (HTTPS/TLS), controle de
            acesso baseado em permissões por função, autenticação segura via Google OAuth 2.0 e
            backups periódicos. Apenas profissionais autorizados e com permissões específicas podem
            acessar os dados na Plataforma.
          </Paragraph>

          <SectionTitle>
            7. Retenção dos Dados
          </SectionTitle>
          <Paragraph>
            Os dados pessoais são mantidos pelo período necessário ao cumprimento das finalidades
            descritas nesta Política e das obrigações legais aplicáveis. Prontuários clínicos são
            mantidos pelo prazo mínimo de 20 anos, conforme exigido pela legislação sanitária
            brasileira (Resolução CFM 1.821/2007). Após o término do prazo de retenção, os dados
            serão eliminados ou anonimizados.
          </Paragraph>

          <SectionTitle>
            8. Direitos dos Titulares
          </SectionTitle>
          <Paragraph>
            Em conformidade com a LGPD, os titulares dos dados (pacientes e profissionais) têm
            direito a: (a) confirmar a existência de tratamento de seus dados; (b) acessar seus dados;
            (c) solicitar a correção de dados incompletos ou desatualizados; (d) solicitar a
            anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;
            (e) solicitar a portabilidade dos dados; (f) obter informações sobre compartilhamento de
            dados; (g) revogar consentimento, quando aplicável. Para exercer esses direitos, entre em
            contato com a administração da clínica.
          </Paragraph>

          <SectionTitle>
            9. Cookies e Tecnologias de Rastreamento
          </SectionTitle>
          <Paragraph>
            A Plataforma utiliza apenas cookies estritamente necessários para o funcionamento da
            autenticação e manutenção da sessão do usuário. Não são utilizados cookies de rastreamento,
            publicidade ou analytics de terceiros.
          </Paragraph>

          <SectionTitle>
            10. Incidentes de Segurança
          </SectionTitle>
          <Paragraph>
            Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos
            titulares, a {BRAND_LEGAL_NAME} comunicará a Autoridade Nacional de Proteção
            de Dados (ANPD) e os titulares afetados, conforme previsto na LGPD.
          </Paragraph>

          <SectionTitle>
            11. Alterações nesta Política
          </SectionTitle>
          <Paragraph>
            Esta Política de Privacidade pode ser atualizada periodicamente. Quaisquer alterações
            serão publicadas nesta página com a data de atualização revisada. Recomendamos a revisão
            periódica deste documento.
          </Paragraph>

          <SectionTitle>
            12. Contato e Encarregado (DPO)
          </SectionTitle>
          <Paragraph>
            Para dúvidas, solicitações ou exercício de direitos relacionados a dados pessoais, entre
            em contato com a equipe da {BRAND_LEGAL_NAME} ou com a administração da sua clínica.
          </Paragraph>
        </Box>

        <Typography sx={{ mt: 4, textAlign: 'center', fontSize: fontSizes.sm, fontWeight: 500, color: 'grey.400' }}>
          © {new Date().getFullYear()} {BRAND_NAME} ·{' '}
          <MuiLink component={Link} to="/termos" underline="none" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Termos de Uso
          </MuiLink>
        </Typography>
      </Box>
    </Box>
  );
}
