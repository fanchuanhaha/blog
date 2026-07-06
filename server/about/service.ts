import type { CloudflareEnv } from '../../types/env'
import type { AboutDetail } from '../../types/about'
import { ABOUT_SINGLETON_ID } from './constants'
import { getAboutFromSource, normalizeAboutSource } from './source'

async function readAboutRow(env: CloudflareEnv): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT source FROM about_content WHERE id = ?',
  ).bind(ABOUT_SINGLETON_ID).first<{ source: string }>()
  return row?.source ?? null
}

export async function getAbout(env: CloudflareEnv, options: { includeSource?: boolean } = {}): Promise<AboutDetail | null> {
  const source = await readAboutRow(env)
  if (!source)
    return null

  return getAboutFromSource(source, options)
}

export async function upsertAbout(env: CloudflareEnv, source: string) {
  const normalized = normalizeAboutSource(source)

  await env.DB.prepare(`
    INSERT INTO about_content (id, source, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      updated_at = datetime('now')
  `).bind(ABOUT_SINGLETON_ID, normalized).run()

  const detail = await getAboutFromSource(normalized)
  return {
    detail,
  }
}
