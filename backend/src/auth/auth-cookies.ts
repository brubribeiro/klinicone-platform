import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

/** Cookie HttpOnly da sessão atual (Bearer JWT). */
export const ACCESS_TOKEN_COOKIE = 'access_token';
/** Cookie HttpOnly do admin durante personificação / "entrar como". */
export const ADMIN_TOKEN_COOKIE = 'admin_token';

/** Converte JWT_EXPIRES_IN (`4h`, `30m`, `7d`, segundos) em milissegundos. */
export function jwtExpiresToMs(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const match = /^(\d+)([smhd])?$/i.exec(trimmed);
  if (!match) return 4 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const mult =
    unit === 'd' ? 86_400_000 : unit === 'h' ? 3_600_000 : unit === 'm' ? 60_000 : 1000;
  return n * mult;
}

export function authCookieOptions(config: ConfigService, maxAgeMs?: number): CookieOptions {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const expiresIn = config.get<string>('JWT_EXPIRES_IN', '4h');
  return {
    httpOnly: true,
    secure: isProd,
    // Cross-origin (Vercel ↔ Render) exige None+Secure; local (mesma site) usa Lax.
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs ?? jwtExpiresToMs(expiresIn),
  };
}

export function setAccessTokenCookie(res: Response, token: string, config: ConfigService) {
  res.cookie(ACCESS_TOKEN_COOKIE, token, authCookieOptions(config));
}

export function setAdminTokenCookie(res: Response, token: string, config: ConfigService) {
  res.cookie(ADMIN_TOKEN_COOKIE, token, authCookieOptions(config));
}

export function clearAuthCookies(res: Response, config: ConfigService) {
  const base = authCookieOptions(config, 0);
  res.clearCookie(ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(ADMIN_TOKEN_COOKIE, base);
}

/** Lê o JWT do cookie HttpOnly ou do header Authorization (clientes/API que ainda enviam Bearer). */
export function extractAccessToken(req: Request): string | null {
  const fromCookie = req?.cookies?.[ACCESS_TOKEN_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  const header = req?.headers?.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim() || null;
  }
  return null;
}

export function readAdminTokenCookie(req: Request): string | null {
  const value = req?.cookies?.[ADMIN_TOKEN_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function readAccessTokenCookie(req: Request): string | null {
  const value = req?.cookies?.[ACCESS_TOKEN_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
