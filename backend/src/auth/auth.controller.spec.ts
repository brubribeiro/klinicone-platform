import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';

describe('AuthController POST /auth/google', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: GoogleLoginDto, data: '' });

  it('accepts { code } and { credential }', async () => {
    await expect(validate({ code: '4/0Ab' })).resolves.toMatchObject({ code: '4/0Ab' });
    await expect(validate({ credential: 'eyJ' })).resolves.toMatchObject({ credential: 'eyJ' });
  });

  it('rejects an empty body or empty values', async () => {
    await expect(validate({})).rejects.toBeDefined();
    await expect(validate({ code: '' })).rejects.toBeDefined();
  });

  it('passes the dto to the service and sets the session cookie', async () => {
    const auth = { loginWithGoogle: jest.fn().mockResolvedValue({ access_token: 'jwt', user: { id: 'u1' } }) };
    const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
    const controller = new AuthController(auth as unknown as AuthService, config as unknown as ConfigService);
    const res = { cookie: jest.fn() };

    const result = await controller.loginWithGoogle({ code: 'auth-code' }, res as any);

    expect(auth.loginWithGoogle).toHaveBeenCalledWith({ code: 'auth-code' });
    expect(res.cookie).toHaveBeenCalledWith('access_token', 'jwt', expect.any(Object));
    expect(result.access_token).toBe('jwt');
  });
});
