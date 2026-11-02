import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';

import type { User } from '../../types';
import { FeedbackReportDialog } from '../feedback/FeedbackReportDialog';
import { fontSizes } from '../../theme/fontSizes';
import { isNavPathActive, type NavGroup } from './navConfig';
import {
  SIDEBAR_ACTIVE,
  SIDEBAR_BG,
  SIDEBAR_BORDER,
  SIDEBAR_HOVER,
  SIDEBAR_TEXT,
  drawerTransition,
} from './layoutTheme';

const USER_AVATAR_SX = {
  width: 38,
  height: 38,
  borderRadius: '11px',
  background: 'linear-gradient(135deg,#3A6B64,#1F4A45)',
  color: '#CFECE7',
  fontSize: fontSizes.xs,
  fontWeight: 700,
} as const;

const USER_MENU_TOGGLE_SX = {
  width: 34,
  height: 34,
  borderRadius: '10px',
  bgcolor: SIDEBAR_HOVER,
  color: SIDEBAR_TEXT,
  '&:hover': { color: '#fff', bgcolor: 'rgba(21,153,139,.28)' },
} as const;

function userInitials(name: string | undefined) {
  return (name ?? '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface SidebarContentProps {
  collapsed: boolean;
  groups: NavGroup[];
  pathname: string;
  onNavigate: (path: string) => void;
  user: User | null;
  onLogout: () => void;
}

export function SidebarContent({ collapsed: isCollapsed, groups, pathname, onNavigate, user, onLogout }: SidebarContentProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const initials = userInitials(user?.name);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const userMenuOpen = Boolean(userMenuAnchor);

  const navScrollSx = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    py: 1.25,
    px: isCollapsed ? 0.5 : 1,
    scrollbarWidth: 'thin' as const,
    scrollbarColor: `rgba(255,255,255,0.16) transparent`,
    '&::-webkit-scrollbar': { width: 7 },
    '&::-webkit-scrollbar-track': {
      margin: '6px 0',
      backgroundColor: 'transparent',
      borderRadius: 10,
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 10,
      border: '2px solid transparent',
      backgroundClip: 'padding-box',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.24)',
      },
    },
  };

  const contentTransition = drawerTransition(theme, [
    'opacity',
    'max-height',
    'padding',
    'margin',
    'background-color',
  ]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: SIDEBAR_BG,
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          px: isCollapsed ? 0.75 : 2.25,
          py: isCollapsed ? 1 : 2,
          borderBottom: '1px solid',
          borderColor: SIDEBAR_BORDER,
          bgcolor: SIDEBAR_BG,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            gap: 1.5,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg,#22BBAA,#0E7C7B)',
              boxShadow: '0 6px 18px -4px rgba(15,124,123,.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
              <path d="M12 3c4.2 5 6.2 8.2 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 11.2 7.8 8 12 3z" />
            </svg>
          </Box>
          {!isCollapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                sx={{ letterSpacing: '-0.02em', lineHeight: 1.05, color: '#fff' }}
              >
                Mila Barreto
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mt: 0,
                  lineHeight: 1.1,
                  color: SIDEBAR_TEXT,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  fontSize: fontSizes['3xs'],
                  textTransform: 'uppercase',
                }}
              >
                Estética avançada
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={navScrollSx}>
        {groups.map((group, groupIndex) => (
          <Fragment key={group.items.map((it) => it.path).join('-')}>
            {group.title && (
              <Box
                component="span"
                sx={{
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  color: SIDEBAR_TEXT,
                  opacity: isCollapsed ? 0 : 0.5,
                  maxHeight: isCollapsed ? 0 : 40,
                  px: 1.75,
                  pt: isCollapsed ? 0 : groupIndex === 0 ? 0.5 : 1.75,
                  pb: isCollapsed ? 0 : 0.75,
                  fontSize: fontSizes['3xs'],
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  transition: contentTransition,
                }}
              >
                {group.title}
              </Box>
            )}
            <List disablePadding sx={{ px: isCollapsed ? 0.5 : 0.85, py: 0 }}>
              {group.items.map((item) => {
                const selected = isNavPathActive(pathname, item.path);
                return (
                  <Tooltip
                    key={item.path}
                    title={isCollapsed ? item.label : ''}
                    placement="right"
                    arrow
                    disableHoverListener={!isCollapsed}
                    disableFocusListener={!isCollapsed}
                    disableTouchListener={!isCollapsed}
                  >
                    <ListItemButton
                      selected={selected}
                      onClick={() => onNavigate(item.path)}
                      sx={{
                        minHeight: 44,
                        mb: 0.35,
                        py: 0.9,
                        px: isCollapsed ? 1.25 : 1.15,
                        borderRadius: '12px',
                        position: 'relative',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        color: selected ? '#fff' : SIDEBAR_TEXT,
                        transition: contentTransition,
                        '& .MuiListItemIcon-root': {
                          minWidth: 0,
                          justifyContent: 'center',
                          mr: isCollapsed ? 0 : 1.75,
                          color: selected ? '#fff' : SIDEBAR_TEXT,
                          transition: contentTransition,
                        },
                        '& .MuiListItemText-root': {
                          my: 0,
                          flexGrow: isCollapsed ? 0 : 1,
                          width: isCollapsed ? 0 : 'auto',
                          overflow: 'hidden',
                          opacity: isCollapsed ? 0 : 1,
                          transition: contentTransition,
                        },
                        '& .MuiListItemText-primary': {
                          whiteSpace: 'nowrap',
                          fontSize: theme.typography.body2.fontSize,
                          fontWeight: selected ? 700 : 600,
                          color: selected ? '#fff' : SIDEBAR_TEXT,
                        },
                        '&.Mui-selected': {
                          bgcolor: SIDEBAR_ACTIVE,
                          color: '#fff',
                          boxShadow: '0 6px 16px -6px rgba(21,153,139,.8)',
                          '& .MuiListItemIcon-root': { color: '#fff' },
                          '& .MuiListItemText-primary': { color: '#fff' },
                          '&:hover': { bgcolor: SIDEBAR_ACTIVE },
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 3,
                            height: 18,
                            borderRadius: '0 4px 4px 0',
                            bgcolor: '#fff',
                            opacity: isCollapsed ? 0 : 1,
                          },
                        },
                        '&:hover': {
                          bgcolor: SIDEBAR_HOVER,
                        },
                      }}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </Tooltip>
                );
              })}
            </List>
          </Fragment>
        ))}
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          px: isCollapsed ? 0.75 : 1.5,
          py: 1.25,
          borderTop: '1px solid',
          borderColor: SIDEBAR_BORDER,
        }}
      >
        {isCollapsed ? (
          <Tooltip title={`${user?.name ?? 'Usuário'}${user?.roleName ? ` · ${user.roleName}` : ''}`} placement="right">
            <Avatar
              variant="rounded"
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen ? 'true' : undefined}
              aria-label="Menu do usuário"
              sx={{ ...USER_AVATAR_SX, cursor: 'pointer' }}
            >
              {initials}
            </Avatar>
          </Tooltip>
        ) : (
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              component="button"
              type="button"
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen ? 'true' : undefined}
              aria-label="Menu do usuário"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                minWidth: 0,
                flex: 1,
                p: 0,
                m: 0,
                border: 0,
                bgcolor: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: '12px',
                '&:hover .user-menu-avatar': {
                  boxShadow: '0 0 0 2px rgba(21,153,139,0.45)',
                },
              }}
            >
              <Avatar className="user-menu-avatar" variant="rounded" sx={{ ...USER_AVATAR_SX, flexShrink: 0 }}>
                {initials}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontSize: fontSizes.sm, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                  {user?.name ?? 'Usuário'}
                </Typography>
                {user?.roleName && (
                  <Typography noWrap sx={{ fontSize: fontSizes['2xs'], color: SIDEBAR_TEXT, lineHeight: 1.2 }}>
                    {user.roleName}
                  </Typography>
                )}
              </Box>
            </Box>
            <Tooltip title="Menu do usuário">
              <IconButton
                aria-label="Menu do usuário"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen ? 'true' : undefined}
                size="small"
                onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                sx={{ ...USER_MENU_TOGGLE_SX, flexShrink: 0 }}
              >
                <MoreVertOutlinedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>

      <Menu
        anchorEl={userMenuAnchor}
        open={userMenuOpen}
        onClose={() => setUserMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: -1,
              minWidth: 220,
              borderRadius: '14px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 10px 30px rgba(14,41,38,0.12)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            setUserMenuAnchor(null);
            setFeedbackOpen(true);
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <FeedbackOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Reportar bug ou sugestão"
            primaryTypographyProps={{ fontSize: fontSizes.sm, fontWeight: 600 }}
          />
        </MenuItem>
        {user?.canChoosePanel && (
          <MenuItem
            onClick={() => {
              setUserMenuAnchor(null);
              navigate('/escolher-painel');
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <SwapHorizOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Trocar painel"
              primaryTypographyProps={{ fontSize: fontSizes.sm, fontWeight: 600 }}
            />
          </MenuItem>
        )}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => {
            setUserMenuAnchor(null);
            onLogout();
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Sair"
            primaryTypographyProps={{ fontSize: fontSizes.sm, fontWeight: 600 }}
          />
        </MenuItem>
      </Menu>

      <FeedbackReportDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </Box>
  );
}
