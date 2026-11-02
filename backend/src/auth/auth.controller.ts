import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { SelectPanelDto } from './dto/select-panel.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  ADMIN_TOKEN_COOKIE,
  authCookieOptions,
  clearAuthCookies,
  readAccessTokenCookie,
  readAdminTokenCookie,
  setAccessTokenCookie,
  setAdminTokenCookie,
} from './auth-cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('google')
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginWithGoogle(dto);
    setAccessTokenCookie(res, result.access_token, this.config);
    // Token também no body para clientes que ainda usam Bearer; o painel usa só o cookie HttpOnly.
    return result;
  }

  /**
   * Retorna o usuário autenticado com role e permissões.
   * Chamado pelo frontend ao iniciar a app para hidratar o contexto.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    const { tokenVersion: _tv, ...safe } = user;
    return {
      ...safe,
      ...(user.impersonatorId ? { impersonating: true } : {}),
    };
  }

  /**
   * Permite que um administrador personifique outro profissional.
   * Retorna um novo JWT com as permissões do usuário alvo.
   */
  @UseGuards(JwtAuthGuard)
  @Post('select-panel')
  async selectPanel(
    @Body() dto: SelectPanelDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.selectPanel(user, dto.panel);
    setAccessTokenCookie(res, result.access_token, this.config);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('impersonate/:userId')
  async impersonate(
    @Param('userId') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.impersonate(userId, admin);
    const current = readAccessTokenCookie(req);
    if (current) setAdminTokenCookie(res, current, this.config);
    setAccessTokenCookie(res, result.access_token, this.config);
    return result;
  }

  /**
   * Restaura o cookie do admin após personificação / "entrar como".
   * O token admin fica só em cookie HttpOnly (não no localStorage).
   */
  @Post('stop-impersonating')
  stopImpersonating(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const adminToken = readAdminTokenCookie(req);
    if (!adminToken) {
      throw new UnauthorizedException('Não há sessão de administrador para restaurar.');
    }
    setAccessTokenCookie(res, adminToken, this.config);
    res.clearCookie(ADMIN_TOKEN_COOKIE, authCookieOptions(this.config, 0));
    return { ok: true };
  }

  /**
   * Encerra a sessão: incrementa tokenVersion (JWT antigo deixa de valer) e limpa cookies.
   */
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ids: string[] = [];
    const access = readAccessTokenCookie(req) ?? extractBearer(req);
    const admin = readAdminTokenCookie(req);
    for (const token of [access, admin]) {
      if (!token) continue;
      const payload = this.auth.peekPayload(token);
      if (payload?.sub) ids.push(payload.sub);
    }
    await this.auth.revokeSessions(ids);
    clearAuthCookies(res, this.config);
    return { ok: true };
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim() || null;
  }
  return null;
}
