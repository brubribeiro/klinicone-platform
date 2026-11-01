/** MIME types aceitos em upload de documentos (multer + magic bytes). */
export const DOCUMENT_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

/** Fotos de paciente/profissional. */
export const PHOTO_ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
