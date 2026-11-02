import { AuroraIcon } from '../AuroraIcon';
import type { Permission } from '../../contexts/permissions';
import type { PlatformFeature } from '../../features/platformFeatures';

export interface NavRouteItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: Permission;
  /** Módulo do plano; sem feature = sempre visível (dashboard, usuários, etc.). */
  feature?: PlatformFeature;
  /** Só o grupo Administrador da clínica vê o item. */
  adminOnly?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavRouteItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', path: '/', icon: <AuroraIcon name="dashboard" /> },
      { label: 'Pendências', path: '/pendencias', icon: <AuroraIcon name="pendencias" />, permission: 'pendencias:view' },
      { label: 'Agenda', path: '/agenda', icon: <AuroraIcon name="agenda" />, permission: 'appointments:view', feature: 'appointments' },
      { label: 'Pacientes', path: '/pacientes', icon: <AuroraIcon name="clientes" />, permission: 'patients:view', feature: 'patients' },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { label: 'Procedimentos', path: '/procedimentos', icon: <AuroraIcon name="procedimentos" />, permission: 'procedures:view', feature: 'procedures' },
      { label: 'Rotinas de skincare', path: '/rotinas', icon: <AuroraIcon name="rotinas" />, permission: 'routines:view', feature: 'routines' },
      { label: 'Pacotes', path: '/pacotes', icon: <AuroraIcon name="pacotes" />, permission: 'packages:view', feature: 'packages' },
      { label: 'Promoções', path: '/promocoes', icon: <AuroraIcon name="promocoes" />, permission: 'promotions:view', feature: 'promotions' },
    ],
  },
  {
    title: 'Equipe & recursos',
    items: [
      { label: 'Profissionais', path: '/profissionais', icon: <AuroraIcon name="profissionais" />, permission: 'users:view' },
      { label: 'Usuários', path: '/usuarios', icon: <AuroraIcon name="permissoes" />, permission: 'users:view' },
      { label: 'Horários', path: '/horarios', icon: <AuroraIcon name="horarios" />, feature: 'availability' },
      { label: 'Equipamentos', path: '/equipamentos', icon: <AuroraIcon name="equipamentos" />, permission: 'equipment:view', feature: 'equipment' },
      { label: 'Estoque', path: '/estoque', icon: <AuroraIcon name="estoque" />, permission: 'inventory:view', feature: 'inventory' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Financeiro', path: '/financeiro', icon: <AuroraIcon name="financeiro" />, permission: 'finance:view', feature: 'finance' },
      { label: 'Despesas recorrentes', path: '/despesas-recorrentes', icon: <AuroraIcon name="despesas" />, permission: 'finance:view', feature: 'recurring_expenses' },
      { label: 'Formas de pagamento', path: '/formas-pagamento', icon: <AuroraIcon name="pagamentos" />, permission: 'payment-methods:view', feature: 'payment_methods' },
    ],
  },
  {
    title: 'Análise',
    items: [
      { label: 'Métricas', path: '/metricas', icon: <AuroraIcon name="relatorios" />, permission: 'metrics:view', feature: 'metrics' },
      { label: 'Metas', path: '/metas', icon: <AuroraIcon name="metas" />, permission: 'goals:view', feature: 'goals' },
      { label: 'Documentos', path: '/documentos', icon: <AuroraIcon name="documentos" />, permission: 'documents:view', feature: 'documents' },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { label: 'Mensagens', path: '/mensagens', icon: <AuroraIcon name="mensagens" />, permission: 'messages:view', feature: 'messages' },
      { label: 'Grupos', path: '/grupos', icon: <AuroraIcon name="permissoes" />, permission: 'roles:view' },
      { label: 'Meu plano', path: '/meu-plano', icon: <AuroraIcon name="pagamentos" />, adminOnly: true },
    ],
  },
];

export function isNavPathActive(pathname: string, itemPath: string): boolean {
  return itemPath === '/' ? pathname === '/' : pathname.startsWith(itemPath);
}
