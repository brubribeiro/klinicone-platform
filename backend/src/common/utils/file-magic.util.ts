import { BadRequestException } from '@nestjs/common';

/** Detecta MIME pelos magic bytes (não confia no Content-Type do cliente). */
export function detectMimeFromMagic(buffer: Buffer): string | null {
  if (!buffer?.length) return null;

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  // OLE Compound Document (doc/xls antigos)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return 'application/msword'; // também cobre xls; refinado abaixo pelo claimed
  }
  // ZIP (docx/xlsx/…)
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)) {
    return 'application/zip';
  }

  return null;
}

const TEXT_MIMES = new Set(['text/plain', 'text/csv']);

const OFFICE_ZIP_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const OFFICE_OLE_MIMES = new Set([
  'application/msword',
  'application/vnd.ms-excel',
]);

/** Buffer parece texto (sem NUL nos primeiros bytes) — para text/plain e text/csv. */
export function looksLikeText(buffer: Buffer, sample = 512): boolean {
  const n = Math.min(buffer.length, sample);
  if (n === 0) return false;
  for (let i = 0; i < n; i++) {
    if (buffer[i] === 0) return false;
  }
  return true;
}

/**
 * Valida o conteúdo contra a allowlist: usa magic bytes e, se necessário, o MIME declarado
 * só para desambiguar ZIP/OLE/texto. Retorna o MIME efetivo a gravar.
 */
export function assertAllowedFileContent(
  buffer: Buffer,
  claimedMime: string,
  allowlist: ReadonlySet<string>,
): string {
  const detected = detectMimeFromMagic(buffer);

  if (detected === 'image/jpeg' || detected === 'image/png' || detected === 'image/gif' || detected === 'image/webp') {
    if (!allowlist.has(detected)) {
      throw new BadRequestException(`Tipo de arquivo não permitido: ${detected}`);
    }
    return detected;
  }

  if (detected === 'application/pdf') {
    if (!allowlist.has('application/pdf')) {
      throw new BadRequestException('Tipo de arquivo não permitido: application/pdf');
    }
    return 'application/pdf';
  }

  if (detected === 'application/zip') {
    if (OFFICE_ZIP_MIMES.has(claimedMime) && allowlist.has(claimedMime)) {
      return claimedMime;
    }
    throw new BadRequestException('Arquivo ZIP/Office não permitido ou MIME inconsistente.');
  }

  if (detected === 'application/msword') {
    if (OFFICE_OLE_MIMES.has(claimedMime) && allowlist.has(claimedMime)) {
      return claimedMime;
    }
    // allowlist só com msword
    if (allowlist.has('application/msword') && claimedMime === 'application/msword') {
      return 'application/msword';
    }
    throw new BadRequestException('Arquivo Office legado não permitido ou MIME inconsistente.');
  }

  if (!detected && TEXT_MIMES.has(claimedMime) && allowlist.has(claimedMime) && looksLikeText(buffer)) {
    return claimedMime;
  }

  throw new BadRequestException(
    detected
      ? `Tipo de arquivo não permitido: ${detected}`
      : 'Não foi possível validar o conteúdo do arquivo. Use um tipo permitido.',
  );
}
