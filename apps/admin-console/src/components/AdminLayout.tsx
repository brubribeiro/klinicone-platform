import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { alpha, AppBar, Box, Drawer, IconButton, Toolbar, Typography, useTheme } from '@mui/material';

import { useAuth } from '../../../../frontend/src/contexts/AuthContext';
import { AuroraIcon } from '../../../../frontend/src/components/AuroraIcon';
import { PAGE_SHELL_SX } from '../../../../frontend/src/theme/layout';
import type { NavGroup } from '../../../../frontend/src/components/layout/navConfig';
import {
  DRAWER_COLLAPSED_WIDTH,
  DRAWER_WIDTH,
  SIDEBAR_BG,
  drawerTransition,
} from '../../../../frontend/src/components/layout/layoutTheme';
import { SidebarContent } from '../../../../frontend/src/components/layout/SidebarContent';
import { AssistantFab } from '../../../../frontend/src/components/assistant/AssistantFab';
import { adminPath } from '../../../../frontend/src/utils/adminPath';

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    title: 'Plataforma',
    items: [
      { label: 'Clínicas', path: adminPath('/clinicas'), icon: <AuroraIcon name="dashboard" /> },
      { label: 'Planos', path: adminPath('/planos'), icon: <AuroraIcon name="pacotes" /> },
      { label: 'Catálogos', path: adminPath('/catalogos'), icon: <AuroraIcon name="documentos" /> },
      { label: 'Medidas', path: adminPath('/medidas'), icon: <AuroraIcon name="metas" /> },
      { label: 'Super-admins', path: adminPath('/super-admins'), icon: <AuroraIcon name="lock" /> },
      { label: 'Uso', path: adminPath('/uso'), icon: <AuroraIcon name="relatorios" /> },
      { label: 'Saúde da API', path: adminPath('/saude'), icon: <AuroraIcon name="eye" /> },
      { label: 'Reports', path: adminPath('/reports'), icon: <AuroraIcon name="feedback" /> },
      { label: 'Anúncios', path: adminPath('/anuncios'), icon: <AuroraIcon name="bell" /> },
      { label: 'Auditoria', path: adminPath('/auditoria'), icon: <AuroraIcon name="clock" /> },
    ],
  },
];

const ADMIN_ASSISTANT_SUGGESTIONS = [
  'Como funciona o Entrar como?',
  'Como funciona o multi-tenant?',
  'Como subir o ambiente local?',
];

const ADMIN_PAGE_META: { path: string; title: string; subtitle: string }[] = [
  { path: adminPath('/clinicas'), title: 'Clínicas', subtitle: 'Clínicas da plataforma, acesso e uso' },
  { path: adminPath('/planos'), title: 'Planos', subtitle: 'Preço, módulos e limites (sem cobrança automática)' },
  {
    path: adminPath('/catalogos'),
    title: 'Catálogos',
    subtitle: 'Opções globais compartilhadas por todas as clínicas',
  },
  {
    path: adminPath('/medidas'),
    title: 'Medidas corporais',
    subtitle: 'Tipos de medida do card “Medidas corporais” da ficha (todas as clínicas)',
  },
  {
    path: adminPath('/super-admins'),
    title: 'Super-admins',
    subtitle: 'Quem acessa o console da plataforma (criar, promover e remover)',
  },
  {
    path: adminPath('/uso'),
    title: 'Uso por funcionalidade',
    subtitle: 'Uso dos módulos por clínica e no total (só contagens, sem dados clínicos)',
  },
  {
    path: adminPath('/saude'),
    title: 'Saúde da API',
    subtitle: 'Erros 5xx e rotas lentas das requisições (agregado por hora, guardado por 30 dias)',
  },
  {
    path: adminPath('/reports'),
    title: 'Central de reports',
    subtitle: 'Bugs e sugestões enviados pelas clínicas',
  },
  {
    path: adminPath('/anuncios'),
    title: 'Anúncios de release',
    subtitle: 'Avise as clínicas sobre novidades e correções (aparece no sino)',
  },
  {
    path: adminPath('/auditoria'),
    title: 'Auditoria da plataforma',
    subtitle: 'Ações do super-admin nas clínicas, planos e catálogos',
  },
];

function adminPageMeta(pathname: string) {
  return (
    ADMIN_PAGE_META.find((m) => pathname === m.path || pathname.startsWith(`${m.path}/`)) ?? {
      title: 'Painel da plataforma',
      subtitle: '',
    }
  );
}

/** Layout da área /admin (super-admin): mesmo shell Aurora do app, com menu próprio. */
export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { user, logout } = useAuth();
  const sidebarUser = useMemo(() => (user ? { ...user, roleName: 'Super-admin' } : null), [user]);

  const pageMeta = adminPageMeta(location.pathname);
  const currentDrawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const drawer = (isCollapsed: boolean) => (
    <SidebarContent
      collapsed={isCollapsed}
      groups={ADMIN_NAV_GROUPS}
      pathname={location.pathname}
      onNavigate={(path) => {
        navigate(path);
        setMobileOpen(false);
      }}
      user={sidebarUser}
      onLogout={logout}
    />
  );

  const drawerPaperSx = {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    bgcolor: SIDEBAR_BG,
    borderRight: 'none',
  } as const;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          transition: drawerTransition(theme, ['width', 'margin-left']),
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 58, md: 66 }, px: { xs: 1.5, md: 2.5 }, gap: 1.5 }}>
          <IconButton
            color="inherit"
            edge="start"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{
              mr: { xs: 0.5, md: 0 },
              display: { md: 'none' },
              border: '1px solid',
              borderColor: alpha(theme.palette.divider, 0.9),
              borderRadius: 2,
            }}
          >
            <AuroraIcon name="menu" size={22} strokeWidth={1.9} />
          </IconButton>

          <IconButton
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              width: 40,
              height: 40,
              mr: 1.5,
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '11px',
              '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
            }}
          >
            <AuroraIcon name="menu" size={20} strokeWidth={1.9} />
          </IconButton>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              component="h1"
              sx={{
                fontSize: { xs: '1.05rem', md: '1.25rem' },
                fontWeight: 800,
                letterSpacing: '-0.5px',
                lineHeight: 1.15,
                color: 'text.primary',
              }}
            >
              {pageMeta.title}
            </Typography>
            {pageMeta.subtitle && (
              <Typography
                noWrap
                variant="caption"
                sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary', fontWeight: 500, lineHeight: 1.2 }}
              >
                {pageMeta.subtitle}
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1 }} />
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: currentDrawerWidth }, flexShrink: { md: 0 }, transition: drawerTransition(theme, 'width') }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { ...drawerPaperSx, width: DRAWER_WIDTH },
          }}
        >
          {drawer(false)}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              ...drawerPaperSx,
              width: currentDrawerWidth,
              overflowX: 'hidden',
              transition: drawerTransition(theme, 'width'),
            },
          }}
        >
          {drawer(collapsed)}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 4 },
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          overflow: 'hidden',
          transition: drawerTransition(theme, 'width'),
        }}
      >
        <Toolbar />
        <Box sx={PAGE_SHELL_SX}>
          <Outlet />
        </Box>
      </Box>

      <AssistantFab suggestions={ADMIN_ASSISTANT_SUGGESTIONS} />
    </Box>
  );
}
