import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * Login Google: `code` (fluxo auth-code do botão próprio, trocado no backend)
 * ou `credential` (ID token do botão oficial / One Tap — mantido por compatibilidade).
 */
export class GoogleLoginDto {
  @ValidateIf((o: GoogleLoginDto) => o.code === undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  credential?: string;

  @ValidateIf((o: GoogleLoginDto) => o.credential === undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code?: string;
}
