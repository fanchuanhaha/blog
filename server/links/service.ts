import type { CloudflareEnv } from '../../types/env'
import type { LinksDetail } from '../../types/links'
import { LINKS_SINGLETON_ID } from './constants'
import { parseLinksSource, serializeLinksFrontmatter } from './frontmatter'

export async function getLinks(env: CloudflareEnv, options: { includeSource?: boolean } = {}): Promise<LinksDetail | null> {
  const row = await env.DB.prepare(
    'SELECT source FROM links_content WHERE id = ?',
  ).bind(LINKS_SINGLETON_ID).first<{ source: string }>()

  if (!row)
    return null

  const parsed = parseLinksSource(row.source)

  return {
    frontmatter: parsed.frontmatter,
    linkGroups: parsed.linkGroups,
    source: options.includeSource ? row.source : undefined,
  }
}

export async function upsertLinks(env: CloudflareEnv, source: string) {
  const parsed = parseLinksSource(source)
  const normalized = serializeLinksFrontmatter(parsed.frontmatter, parsed.content)

  await env.DB.prepare(`
    INSERT INTO links_content (id, source, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      updated_at = datetime('now')
  `).bind(LINKS_SINGLETON_ID, normalized).run()

  return {
    frontmatter: parsed.frontmatter,
    linkGroups: parsed.linkGroups,
  }
}
