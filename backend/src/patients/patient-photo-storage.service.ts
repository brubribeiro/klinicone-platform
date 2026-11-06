import { BadRequestException, Injectable } from '@nestjs/common';

import { R2StorageService } from '../documents/r2-storage.service';
import { CompressionService } from '../documents/compression.service';
import { assertAllowedFileContent } from '../common/utils/file-magic.util';
import { PHOTO_ALLOWED_MIMES } from '../documents/upload-allowlist';
import { PlanLimitsService } from '../plan-limits/plan-limits.service';

const PATIENT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PATIENT_PHOTO_URL_TTL_SECONDS = 3600;

type WithPhoto = { photoStorageKey?: string | null; photoUrl?: string | null };

/** Fotos de pacientes no R2: validação, upload, remoção e URLs assinadas. */
@Injectable()
export class PatientPhotoStorageService {
  constructor(
    private readonly r2: R2StorageService,
    private readonly compression: CompressionService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  get isConfigured() {
    return this.r2.isConfigured;
  }

  /** URL temporária assinada; lança se o R2 falhar. */
  getSignedUrl(key: string) {
    return this.r2.getPresignedUrl(key, PATIENT_PHOTO_URL_TTL_SECONDS);
  }

  /** URL temporária assinada, ou null se o R2 falhar. */
  signOrNull(key: string): Promise<string | null> {
    return this.getSignedUrl(key).catch(() => null);
  }

  async withAccessUrl<T extends WithPhoto>(patient: T): Promise<T> {
    if (!patient.photoStorageKey || !this.r2.isConfigured) return patient;
    return { ...patient, photoUrl: await this.signOrNull(patient.photoStorageKey) };
  }

  withAccessUrls<T extends WithPhoto>(patients: T[]): Promise<T[]> {
    return Promise.all(patients.map((patient) => this.withAccessUrl(patient)));
  }

  assertUploadable(file: Express.Multer.File, opts: { checkSize: boolean }): string {
    if (!this.r2.isConfigured) {
      throw new BadRequestException('Cloudflare R2 não está configurado. Não é possível enviar a foto.');
    }
    const mimeType = assertAllowedFileContent(file.buffer, file.mimetype, PHOTO_ALLOWED_MIMES);
    if (opts.checkSize && file.size > PATIENT_PHOTO_MAX_BYTES) {
      throw new BadRequestException('A foto deve ter no máximo 5 MB.');
    }
    return mimeType;
  }

  async uploadProfilePhoto(patientId: string, file: Express.Multer.File) {
    const mimeType = this.assertUploadable(file, { checkSize: false });
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const { key } = await this.r2.upload(`foto.${ext}`, mimeType, file.buffer, `pacientes/${patientId}`);
    return key;
  }

  /** Foto "antes e depois": comprimida antes do upload. */
  async uploadGalleryPhoto(patientId: string, phase: string, file: Express.Multer.File) {
    const mimeType = this.assertUploadable(file, { checkSize: false });
    const compressed = await this.compression.compress(file.buffer, mimeType);
    await this.planLimits.assertStorageAvailable(compressed.compressedSize);
    const { key } = await this.r2.upload(
      `${phase.toLowerCase()}.jpg`,
      compressed.mimeType,
      compressed.buffer,
      `pacientes/${patientId}/fotos`,
    );
    return { key, mimeType: compressed.mimeType, size: compressed.compressedSize };
  }

  remove(key: string) {
    return this.r2.remove(key);
  }
}
