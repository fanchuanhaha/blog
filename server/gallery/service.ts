import type { CloudflareEnv } from '../../types/env'
import type { GalleryAlbumDetail, GalleryHubDetail } from '../../types/gallery'
import type { AlbumDetailFrontmatter, AlbumPhoto, AlbumSummary } from '../../types/album'
import {
  GALLERY_HUB_SINGLETON_ID,
  isValidGallerySlug,
} from './constants'
import {
  normalizeAlbumSlugs,
  parseAlbumSource,
  parseHubSource,
  serializeAlbumMarkdown,
  serializeHubMarkdown,
  toAlbumSummary,
} from './frontmatter'

interface AlbumRow {
  slug: string
  source: string
}

interface HubRow {
  source: string
}

async function readHubSource(env: CloudflareEnv): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT source FROM gallery_hub WHERE id = ?',
  ).bind(GALLERY_HUB_SINGLETON_ID).first<HubRow>()
  return row?.source ?? null
}

async function readAlbumSource(env: CloudflareEnv, slug: string): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT source FROM gallery_albums WHERE slug = ?',
  ).bind(slug).first<AlbumRow>()
  return row?.source ?? null
}

async function loadAlbumSummary(env: CloudflareEnv, slug: string): Promise<AlbumSummary | null> {
  const source = await readAlbumSource(env, slug)
  if (!source)
    return null

  const parsed = parseAlbumSource(source)
  return toAlbumSummary(slug, parsed.frontmatter)
}

export async function getGalleryHub(env: CloudflareEnv, options: { includeSource?: boolean } = {}): Promise<GalleryHubDetail | null> {
  const source = await readHubSource(env)
  if (!source)
    return null

  const parsed = parseHubSource(source)
  const slugs = normalizeAlbumSlugs(parsed.frontmatter.albums)
  const summaries: AlbumSummary[] = []

  for (const slug of slugs) {
    const summary = await loadAlbumSummary(env, slug)
    if (summary)
      summaries.push(summary)
  }

  return {
    frontmatter: parsed.frontmatter,
    albums: summaries,
    source: options.includeSource ? source : undefined,
  }
}

export async function getGalleryAlbum(env: CloudflareEnv, slug: string, options: { includeSource?: boolean } = {}): Promise<GalleryAlbumDetail | null> {
  if (!isValidGallerySlug(slug))
    return null

  const source = await readAlbumSource(env, slug)
  if (!source)
    return null

  const parsed = parseAlbumSource(source)

  return {
    slug,
    frontmatter: parsed.frontmatter,
    source: options.includeSource ? source : undefined,
  }
}

export async function unlockGalleryAlbum(env: CloudflareEnv, slug: string, password: string): Promise<{ ok: true, photos: AlbumPhoto[] } | { ok: false }> {
  const detail = await getGalleryAlbum(env, slug)
  if (!detail)
    return { ok: false }

  if (!detail.frontmatter.encrypted)
    return { ok: true, photos: detail.frontmatter.photos || [] }

  const expected = String(detail.frontmatter.password || '').trim()
  if (!expected || password !== expected)
    return { ok: false }

  return { ok: true, photos: detail.frontmatter.photos || [] }
}

export async function upsertGalleryHub(env: CloudflareEnv, source: string) {
  const parsed = parseHubSource(source)
  const normalized = serializeHubMarkdown(parsed.frontmatter, parsed.content)

  await env.DB.prepare(`
    INSERT INTO gallery_hub (id, source, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      updated_at = datetime('now')
  `).bind(GALLERY_HUB_SINGLETON_ID, normalized).run()

  const slugs = normalizeAlbumSlugs(parsed.frontmatter.albums)
  const albums: AlbumSummary[] = []
  for (const slug of slugs) {
    const summary = await loadAlbumSummary(env, slug)
    if (summary)
      albums.push(summary)
  }

  return {
    frontmatter: parsed.frontmatter,
    albums,
  }
}

export async function upsertGalleryAlbum(env: CloudflareEnv, slug: string, source: string) {
  if (!isValidGallerySlug(slug))
    throw new Error('相册 slug 格式无效')

  const parsed = parseAlbumSource(source)
  const normalized = serializeAlbumMarkdown(parsed.frontmatter, parsed.content)

  await env.DB.prepare(`
    INSERT INTO gallery_albums (slug, source, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      source = excluded.source,
      updated_at = datetime('now')
  `).bind(slug, normalized).run()

  return {
    slug,
    frontmatter: parsed.frontmatter,
  }
}

export async function deleteGalleryAlbum(env: CloudflareEnv, slug: string) {
  if (!isValidGallerySlug(slug))
    throw new Error('相册 slug 格式无效')

  await env.DB.prepare('DELETE FROM gallery_albums WHERE slug = ?').bind(slug).run()

  const hub = await getGalleryHub(env, { includeSource: true })
  if (!hub?.source)
    return { slug, removedFromHub: false }

  const parsed = parseHubSource(hub.source)
  const nextSlugs = normalizeAlbumSlugs(parsed.frontmatter.albums).filter(item => item !== slug)
  parsed.frontmatter.albums = nextSlugs
  await upsertGalleryHub(env, serializeHubMarkdown(parsed.frontmatter, parsed.content))

  return { slug, removedFromHub: true }
}

export async function getAlbumWebDavConfigFromR2(env: CloudflareEnv, slug: string) {
  const album = await getGalleryAlbum(env, slug)
  if (!album || album.frontmatter.source !== 'webdav' || !album.frontmatter.webdav?.url)
    return null
  return album.frontmatter.webdav
}

export type { AlbumDetailFrontmatter }
