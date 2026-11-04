import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateSuperAdminDto {
  @Transform(trimLower)
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  email: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Informe o nome.' })
  @MaxLength(120)
  name: string;
}
