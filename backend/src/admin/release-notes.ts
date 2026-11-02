import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { AnnouncementKind } from '@prisma/client';

/** Corpo gerado fica curto: o aviso aparece no sino; o super-admin pode editar antes de enviar. */
export const RELEASE_BODY_MAX = 2000;

export interface ReleaseDraft {
  kind: AnnouncementKind;
  title: string;
  body: string;
}

export interface ReleaseSection {
  version: string;
  drafts: ReleaseDraft[];
}

/** RELEASE_NOTES.md fica na raiz do monorepo; o backend roda de backend/ ou backend/dist/src. */
export function readReleaseNotes(startDir = __dirname): string | null {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const file = join(dir, 'RELEASE_NOTES.md');
    if (existsSync(file)) return readFileSync(file, 'utf8');
    dir = dirname(dir);
  }
  return null;
}

/** "### Correções de segurança" → FIX; "### Novidades" (e o resto) → FEATURE. */
export function kindOfHeading(heading: string): AnnouncementKind {
  return /corre[çc]|corrig|bug|seguran[çc]a/i.test(heading) ? AnnouncementKind.FIX : AnnouncementKind.FEATURE;
}

const KIND_TITLE: Record<AnnouncementKind, string> = {
  FEATURE: 'Novidades da versão',
  FIX: 'Correções da versão',
};

/** Seções genéricas cujo título não precisa repetir no corpo do aviso. */
const GENERIC_HEADING = /^(novidades|corre[çc][õo]es)$/i;

const plain = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();

function capBody(lines: string[]): string {
  const out: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > RELEASE_BODY_MAX - 40) {
      out.push('• E outras melhorias.');
      break;
    }
    out.push(line);
    size += line.length + 1;
  }
  return out.join('\n');
}

/**
 * Extrai do RELEASE_NOTES.md a seção "## vX.Y.Z" (ou a mais recente se `version` não existir)
 * e monta um rascunho por tipo: tópicos "### Novidades" viram FEATURE, "### Correções…" viram FIX.
 * Só entram subtítulos em negrito e itens de lista; parágrafos soltos (ex.: rodapé) ficam de fora.
 */
export function parseReleaseNotes(markdown: string, version?: string): ReleaseSection | null {
  const sections = markdown.split(/^## /m).slice(1);
  const parsed = sections
    .map((raw) => {
      const [header, ...rest] = raw.split('\n');
      const match = header.match(/^v?(\d+\.\d+\.\d+)/);
      return match ? { version: match[1], lines: rest } : null;
    })
    .filter((s): s is { version: string; lines: string[] } => s !== null);
  const section = (version && parsed.find((s) => s.version === version)) || parsed[0];
  if (!section) return null;

  const byKind = new Map<AnnouncementKind, string[]>();
  let kind: AnnouncementKind | null = null;
  for (const raw of section.lines) {
    const line = raw.trim();
    if (line === '---') break;
    const heading = line.match(/^###\s+(.+)/);
    if (heading) {
      kind = kindOfHeading(heading[1]);
      const lines = byKind.get(kind) ?? [];
      byKind.set(kind, lines);
      const title = plain(heading[1]);
      if (!GENERIC_HEADING.test(title)) lines.push(title);
      continue;
    }
    if (!kind) continue;
    const lines = byKind.get(kind)!;
    const bold = line.match(/^\*\*(.+)\*\*$/);
    if (bold) lines.push(`${lines.length ? '\n' : ''}${plain(bold[1])}`);
    else if (/^[-*]\s+/.test(line)) lines.push(`• ${plain(line.replace(/^[-*]\s+/, ''))}`);
  }

  const drafts: ReleaseDraft[] = [];
  for (const k of [AnnouncementKind.FEATURE, AnnouncementKind.FIX]) {
    const lines = byKind.get(k);
    if (!lines?.some((l) => l.startsWith('• '))) continue;
    drafts.push({ kind: k, title: `${KIND_TITLE[k]} ${section.version}`, body: capBody(lines) });
  }
  return { version: section.version, drafts };
}
