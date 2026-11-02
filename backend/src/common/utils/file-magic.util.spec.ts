import { BadRequestException } from '@nestjs/common';

import { assertAllowedFileContent, detectMimeFromMagic, looksLikeText } from './file-magic.util';

const ALLOW = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

describe('file-magic.util', () => {
  it('detects JPEG / PNG / PDF magic', () => {
    expect(detectMimeFromMagic(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(
      detectMimeFromMagic(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png');
    expect(detectMimeFromMagic(Buffer.from('%PDF-1.4'))).toBe('application/pdf');
  });

  it('rejects HTML claimed as JPEG', () => {
    const html = Buffer.from('<!DOCTYPE html><html><body>x</body></html>');
    expect(() => assertAllowedFileContent(html, 'image/jpeg', ALLOW)).toThrow(BadRequestException);
  });

  it('accepts real JPEG bytes even if claimed as PNG', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(assertAllowedFileContent(jpeg, 'image/png', ALLOW)).toBe('image/jpeg');
  });

  it('accepts plain text when claimed and looks like text', () => {
    expect(looksLikeText(Buffer.from('nome;valor\n'))).toBe(true);
    expect(assertAllowedFileContent(Buffer.from('hello'), 'text/plain', ALLOW)).toBe('text/plain');
  });

  it('rejects binary with no magic when not text', () => {
    expect(() => assertAllowedFileContent(Buffer.from([0x00, 0x01, 0x02]), 'image/jpeg', ALLOW)).toThrow(
      BadRequestException,
    );
  });

  it('accepts ZIP only with Office Open XML claimed mime', () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(
      assertAllowedFileContent(
        zip,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ALLOW,
      ),
    ).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(() => assertAllowedFileContent(zip, 'application/pdf', ALLOW)).toThrow(BadRequestException);
  });
});
