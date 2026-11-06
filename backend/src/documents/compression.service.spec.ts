import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

import { CompressionService } from './compression.service';

describe('CompressionService', () => {
  const service = new CompressionService();

  async function image(format: 'jpeg' | 'png' | 'webp' | 'gif') {
    const raw = Buffer.alloc(200 * 200 * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 7) % 256;
    return sharp(raw, { raw: { width: 200, height: 200, channels: 3 } })
      [format]({ quality: 100 } as never)
      .toBuffer();
  }

  it('devolve tipos não suportados sem alterar', async () => {
    const buf = Buffer.from('texto');
    const r = await service.compress(buf, 'text/plain');
    expect(r).toEqual({ buffer: buf, mimeType: 'text/plain', originalSize: 5, compressedSize: 5 });
  });

  it.each(['jpeg', 'png', 'webp', 'gif'] as const)('processa %s sem aumentar o tamanho', async (format) => {
    const buf = await image(format);
    const r = await service.compress(buf, `image/${format}`);
    expect(r.originalSize).toBe(buf.length);
    expect(r.compressedSize).toBeLessThanOrEqual(buf.length);
    expect(r.buffer.length).toBe(r.compressedSize);
  });

  it('comprime imagem muito pesada e troca PNG por WebP quando vale', async () => {
    const big = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#aa5566' } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const r = await service.compress(big, 'image/png');
    expect(r.compressedSize).toBeLessThan(big.length);
    expect(['image/png', 'image/webp']).toContain(r.mimeType);

    const jpg = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#223344' } })
      .jpeg({ quality: 100 })
      .toBuffer();
    const j = await service.compress(jpg, 'image/jpeg');
    expect(j.compressedSize).toBeLessThan(jpg.length);
    expect(j.mimeType).toBe('image/jpeg');
  });

  it('mantém o original quando a imagem está corrompida', async () => {
    const bad = Buffer.from('não é imagem');
    const r = await service.compress(bad, 'image/jpeg');
    expect(r.buffer).toBe(bad);
    expect(r.compressedSize).toBe(bad.length);
  });

  it('reserializa PDF válido e preserva o original quando inválido', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage().drawText(`pagina ${i}`);
    const pdf = Buffer.from(await doc.save({ useObjectStreams: false }));
    const r = await service.compress(pdf, 'application/pdf');
    expect(r.mimeType).toBe('application/pdf');
    expect(r.compressedSize).toBeLessThanOrEqual(pdf.length);

    const bad = Buffer.from('%PDF-quebrado');
    const b = await service.compress(bad, 'application/pdf');
    expect(b.buffer).toBe(bad);
  });
});
