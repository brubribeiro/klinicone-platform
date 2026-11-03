import { ReactNode } from 'react';
import { Typography } from '@mui/material';
import { fontSizes } from '../theme/fontSizes';
import { BRAND_LEGAL_NAME } from '../brand';

/** Fonte única do corpo da Política de Privacidade (painel e landing). */
export const PRIVACY_LAST_UPDATED = 'Junho de 2026';

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

export function PrivacyPolicyContent() {
  return (
    <>
      <SectionTitle>1. Introdução</SectionTitle>
      <Paragraph>
        A {BRAND_LEGAL_NAME} ("nós", "nosso") é responsável pelo tratamento dos dados pessoais coletados por
        meio desta plataforma de gestão SaaS para clínicas ("Plataforma"). Esta Política de Privacidade
        descreve como coletamos, utilizamos, armazenamos e protegemos seus dados, em conformidade com a Lei
        Geral de Proteção de Dados (LGPD - Lei 13.709/2018). Cada clínica contratante permanece controladora
        dos dados de suas pacientes no uso diário da Plataforma.
      </Paragraph>

      <SectionTitle>2. Dados Coletados</SectionTitle>
      <Paragraph>
        <strong>Dados dos profissionais (usuários da Plataforma):</strong> nome, endereço de e-mail (obtido
        via autenticação Google), função/cargo na clínica e registro de atividades na Plataforma.
      </Paragraph>
      <Paragraph>
        <strong>Dados dos pacientes (cadastrados pelos profissionais):</strong> nome completo, CPF, data de
        nascimento, telefone, endereço, e-mail, histórico de procedimentos realizados, prontuários clínicos,
        fotografias (antes/depois), informações financeiras referentes a pagamentos e dados de saúde
        relevantes ao atendimento estético.
      </Paragraph>

      <SectionTitle>3. Finalidade do Tratamento</SectionTitle>
      <Paragraph>
        Os dados são tratados para as seguintes finalidades: (a) gestão de agendamentos e atendimentos da
        clínica; (b) manutenção de prontuários e histórico clínico dos pacientes; (c) controle financeiro e
        faturamento; (d) gestão de estoque e equipamentos; (e) comunicação com pacientes (lembretes,
        confirmações); (f) geração de relatórios e métricas operacionais internas; (g) cumprimento de
        obrigações legais e regulatórias.
      </Paragraph>

      <SectionTitle>4. Base Legal</SectionTitle>
      <Paragraph>
        O tratamento dos dados pessoais é realizado com base nas seguintes hipóteses legais previstas na
        LGPD: (a) execução de contrato ou procedimentos preliminares (Art. 7º, V); (b) cumprimento de
        obrigação legal ou regulatória (Art. 7º, II); (c) tutela da saúde, em procedimento realizado por
        profissionais de saúde (Art. 7º, VIII); (d) legítimo interesse do controlador para gestão interna da
        clínica (Art. 7º, IX). Para dados sensíveis de saúde, o tratamento é fundamentado na tutela da saúde
        (Art. 11, II, f).
      </Paragraph>

      <SectionTitle>5. Compartilhamento de Dados</SectionTitle>
      <Paragraph>
        Os dados pessoais não são vendidos, alugados ou compartilhados com terceiros para fins comerciais. O
        compartilhamento pode ocorrer nas seguintes situações: (a) com prestadores de serviços de tecnologia
        que hospedam ou mantêm a Plataforma, sob obrigações contratuais de sigilo; (b) com o Google, limitado
        ao processo de autenticação (e-mail e nome do usuário); (c) quando exigido por lei, ordem judicial ou
        autoridade competente.
      </Paragraph>

      <SectionTitle>6. Armazenamento e Segurança</SectionTitle>
      <Paragraph>
        Os dados são armazenados em servidores protegidos com medidas de segurança técnicas e administrativas
        adequadas, incluindo: criptografia em trânsito (HTTPS/TLS), controle de acesso baseado em permissões
        por função, autenticação segura via Google OAuth 2.0 e backups periódicos. Apenas profissionais
        autorizados e com permissões específicas podem acessar os dados na Plataforma.
      </Paragraph>

      <SectionTitle>7. Retenção dos Dados</SectionTitle>
      <Paragraph>
        Os dados pessoais são mantidos pelo período necessário ao cumprimento das finalidades descritas nesta
        Política e das obrigações legais aplicáveis. Prontuários clínicos são mantidos pelo prazo mínimo de 20
        anos, conforme exigido pela legislação sanitária brasileira (Resolução CFM 1.821/2007). Após o
        término do prazo de retenção, os dados serão eliminados ou anonimizados.
      </Paragraph>

      <SectionTitle>8. Direitos dos Titulares</SectionTitle>
      <Paragraph>
        Em conformidade com a LGPD, os titulares dos dados (pacientes e profissionais) têm direito a: (a)
        confirmar a existência de tratamento de seus dados; (b) acessar seus dados; (c) solicitar a correção
        de dados incompletos ou desatualizados; (d) solicitar a anonimização, bloqueio ou eliminação de dados
        desnecessários ou tratados em desconformidade; (e) solicitar a portabilidade dos dados; (f) obter
        informações sobre compartilhamento de dados; (g) revogar consentimento, quando aplicável. Para exercer
        esses direitos, entre em contato com a administração da clínica.
      </Paragraph>

      <SectionTitle>9. Cookies e Tecnologias de Rastreamento</SectionTitle>
      <Paragraph>
        A Plataforma utiliza apenas cookies estritamente necessários para o funcionamento da autenticação e
        manutenção da sessão do usuário. Não são utilizados cookies de rastreamento, publicidade ou analytics
        de terceiros.
      </Paragraph>

      <SectionTitle>10. Incidentes de Segurança</SectionTitle>
      <Paragraph>
        Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a{' '}
        {BRAND_LEGAL_NAME} comunicará a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares
        afetados, conforme previsto na LGPD.
      </Paragraph>

      <SectionTitle>11. Alterações nesta Política</SectionTitle>
      <Paragraph>
        Esta Política de Privacidade pode ser atualizada periodicamente. Quaisquer alterações serão
        publicadas nesta página com a data de atualização revisada. Recomendamos a revisão periódica deste
        documento.
      </Paragraph>

      <SectionTitle>12. Contato e Encarregado (DPO)</SectionTitle>
      <Paragraph>
        Para dúvidas, solicitações ou exercício de direitos relacionados a dados pessoais, entre em contato
        com a equipe da {BRAND_LEGAL_NAME} ou com a administração da sua clínica.
      </Paragraph>
    </>
  );
}
