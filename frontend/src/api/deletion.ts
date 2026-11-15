import { api } from './client';
import type { RemoveOptions } from '../utils/deletionConflict';

/** DELETE que aceita `?unlink=true` ("Desvincular e excluir"). */
export async function deleteWithUnlink(url: string, options?: RemoveOptions): Promise<void> {
  if (options?.unlink) await api.delete(url, { params: { unlink: true } });
  else await api.delete(url);
}
