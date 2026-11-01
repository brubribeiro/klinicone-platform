const STORAGE_PREFIX = 'mila.tourSeen';

const storageKey = (userId: string, screenKey: string) => `${STORAGE_PREFIX}.${userId}.${screenKey}`;

/** Concluído ou dispensado: o tour da tela não abre mais sozinho para este usuário. */
export function isTourSeen(userId: string, screenKey: string) {
  return localStorage.getItem(storageKey(userId, screenKey)) !== null;
}

export function markTourSeen(userId: string, screenKey: string) {
  localStorage.setItem(storageKey(userId, screenKey), new Date().toISOString());
}
