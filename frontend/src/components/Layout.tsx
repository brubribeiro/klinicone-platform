import { Fragment, useEffect, useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { alpha, AppBar, Box, Drawer, IconButton, Toolbar, Typography, useTheme } from '@mui/material';

import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/usePermissions';
import { usePrefetchPlatformCatalogs } from '../hooks/usePlatformCatalog';
import { AuditHistoryDialog } from './audit/AuditHistoryDialog';
import { AuroraIcon } from './AuroraIcon';
import { PAGE_SHELL_SX } from '../theme/layout';
import { isMoneyHidden, setMoneyHidden } from '../utils/money';
import { NAV_GROUPS } from './layout/navConfig';
import { getPageMeta, pageSubtitleFor } from './layout/pageMeta';
import {
  DRAWER_COLLAPSED_WIDTH,
  DRAWER_WIDTH,
  IMPERSONATION_BAR_HEIGHT,
  SIDEBAR_BG,
  drawerTransition,
} from './layout/layoutTheme';
import { SidebarContent } from './layout/SidebarContent';
import { HeaderActions } from './layout/HeaderActions';
import { ImpersonationBanner } from './layout/ImpersonationBanner';
import { AssistantFab } from './assistant/AssistantFab';
import { GuidedTour } from './tour/GuidedTour';
import { getScreenTour } from './tour/screenTours';
import { isTourSeen, markTourSeen } from './tour/tourStorage';

const CLINIC_ASSISTANT_SUGGESTIONS = [
  'Como ativo o modo escuro?',
  'Como funciona o mapa de aplicação?',
  'Como montar uma rotina de skincare?',
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, stopImpersonating } = useAuth();
  const isImpersonating = user?.impersonating === true;
  const { has, isAdmin } = usePermissions();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moneyHidden, setMoneyHiddenState] = useState(isMoneyHidden);
  // Catálogo global da plataforma (documentos, mensagens, procedimentos, estoque)
  usePrefetchPlatformCatalogs(!!user?.tenantId);

  const toggleMoneyHidden = () => {
    setMoneyHidden(!moneyHidden);
    setMoneyHiddenState(!moneyHidden);
  };

  const userFeatures = user?.features;
  const visibleGroups = useMemo(() => {
    const features = userFeatures ?? [];
    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            (!item.adminOnly || isAdmin) &&
            (!item.permission || has(item.permission)) &&
            (!item.feature || features.includes(item.feature)),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [has, isAdmin, userFeatures]);

  const theme = useTheme();

  const pageMeta = getPageMeta(location.pathname);
  const pageSubtitle = pageSubtitleFor(location.pathname, pageMeta);

  // Tour guiado da tela: abre sozinho na primeira visita; depois só pelo “Como funciona?”.
  const screenTour = getScreenTour(location.pathname);
  const tourKey = screenTour?.key;
  const userId = user?.id;
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    setTourOpen(false);
    if (!tourKey || !userId || isTourSeen(userId, tourKey)) return;
    // Espera a página montar para os elementos destacados existirem.
    const timer = window.setTimeout(() => setTourOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [tourKey, userId]);
  const closeTour = () => {
    setTourOpen(false);
    if (tourKey && userId) markTourSeen(userId, tourKey);
  };

  const currentDrawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;
  const impersonationOffsetSx = isImpersonating
    ? { top: IMPERSONATION_BAR_HEIGHT, height: `calc(100% - ${IMPERSONATION_BAR_HEIGHT}px)` }
    : {};

  const drawer = (isCollapsed: boolean) => (
    <SidebarContent
      collapsed={isCollapsed}
      groups={visibleGroups}
      pathname={location.pathname}
      onNavigate={(path) => {
        navigate(path);
        setMobileOpen(false);
      }}
      user={user}
      onLogout={logout}
    />
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isImpersonating && (
        // Super-admin "entrou como" a clínica pelo painel: a faixa mostra a clínica
        <ImpersonationBanner
          userName={user?.tenantName ?? user?.name}
          onStop={stopImpersonating}
          stopLabel={user?.tenantName ? 'Voltar ao painel' : undefined}
        />
      )}
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          top: isImpersonating ? IMPERSONATION_BAR_HEIGHT : 0,
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

          <Box sx={{ minWidth: 0, mr: { xs: 1, md: 1.5 } }}>
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
            {pageSubtitle && (
              <Typography
                noWrap
                variant="caption"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  color: 'text.secondary',
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                {pageSubtitle}
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1 }} />

          <HeaderActions
            canSeeHistory={isAdmin}
            hasAuditEntity={!!pageMeta.auditEntity}
            onOpenHistory={() => setHistoryOpen(true)}
            moneyHidden={moneyHidden}
            onToggleMoneyHidden={toggleMoneyHidden}
            canSeeAgenda={has('appointments:view')}
            onOpenTour={screenTour ? () => setTourOpen(true) : undefined}
          />
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: currentDrawerWidth },
          flexShrink: { md: 0 },
          transition: drawerTransition(theme, 'width'),
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: SIDEBAR_BG,
              borderRight: 'none',
              ...impersonationOffsetSx,
            },
          }}
        >
          {drawer(false)}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              borderRight: 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: SIDEBAR_BG,
              transition: drawerTransition(theme, 'width'),
              overflowX: 'hidden',
              ...impersonationOffsetSx,
            },
          }}
          open
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
        {isImpersonating && <Box sx={{ height: IMPERSONATION_BAR_HEIGHT }} />}
        {/* Remonta a página ao alternar o olho para os formatadores de moeda relerem a preferência. */}
        <Fragment key={moneyHidden ? 'money-hidden' : 'money-visible'}>
          <Box sx={PAGE_SHELL_SX}>
            <Outlet />
          </Box>
        </Fragment>
      </Box>

      {screenTour && tourOpen && (
        <GuidedTour key={screenTour.key} steps={screenTour.steps} onClose={closeTour} />
      )}

      <AssistantFab suggestions={CLINIC_ASSISTANT_SUGGESTIONS} canSendFeedback />

      {pageMeta.auditEntity && (
        <AuditHistoryDialog
          key={pageMeta.auditEntity}
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          entity={pageMeta.auditEntity}
          title={pageMeta.title}
        />
      )}
    </Box>
  );
}
