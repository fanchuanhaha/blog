#!/usr/bin/env node
/**
 * 将相册 Markdown 写入 D1（`gallery_hub` + `gallery_albums`）。
 * 不再上传到 R2。
 *
 * 用法:
 *   pnpm migrate:gallery
 *   pnpm migrate:gallery:local
 *
 * 数据源优先级:
 *   content/gallery/** → pages/gallery/**
 */

import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const useLocal = process.argv.includes('--local')
const remoteFlag = useLocal ? '--local' : '--remote'

function runWrangler(args) {
  if (process.platform === 'win32') {
    const cmd = ['wrangler', ...args]
      .map(arg => (/[\s"]/.test(arg) ? `"${String(arg).replace(/"/g, '\\"')}"` : String(arg)))
      .join(' ')
    const result = spawnSync(`npx ${cmd}`, {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    })
    if (result.status !== 0)
      process.exit(result.status || 1)
    return
  }

  const result = spawnSync('npx', ['wrangler', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0)
    process.exit(result.status || 1)
}

function runWranglerSql(sql) {
  const file = join(root, '.migrate-tmp.sql')
  writeFileSync(file, sql, 'utf8')
  try {
    runWrangler(['d1', 'execute', 'aiovtue-blog', remoteFlag, '--file', file])
  }
  finally {
    if (existsSync(file))
      unlinkSync(file)
  }
}

function resolveGalleryRoot() {
  const contentRoot = join(root, 'content', 'gallery')
  if (existsSync(join(contentRoot, 'index.md')))
    return contentRoot

  const pagesRoot = join(root, 'pages', 'gallery')
  if (existsSync(join(pagesRoot, 'index.md')))
    return pagesRoot

  return null
}

const galleryRoot = resolveGalleryRoot()
if (!galleryRoot) {
  console.error('未找到相册源目录，请创建 content/gallery/index.md')
  process.exit(1)
}

const hubPath = join(galleryRoot, 'index.md')
if (!existsSync(hubPath)) {
  console.error('未找到相册列表文件 index.md')
  process.exit(1)
}

console.log(`写入相册中心: ${hubPath} → D1 gallery_hub (${useLocal ? 'local' : 'remote'})`)
{
  const source = readFileSync(hubPath, 'utf8')
  const escaped = source.replace(/'/g, "''")
  const sql = `
    INSERT INTO gallery_hub (id, source, updated_at)
    VALUES (1, '${escaped}', datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      updated_at = datetime('now');
  `
  runWranglerSql(sql)
}

for (const entry of readdirSync(galleryRoot, { withFileTypes: true })) {
  if (!entry.isDirectory())
    continue

  const albumPath = join(galleryRoot, entry.name, 'index.md')
  if (!existsSync(albumPath))
    continue

  const slug = entry.name.replace(/'/g, "''")
  const source = readFileSync(albumPath, 'utf8')
  const escaped = source.replace(/'/g, "''")
  console.log(`写入相册: ${albumPath} → D1 gallery_albums (${useLocal ? 'local' : 'remote'})`)
  const sql = `
    INSERT INTO gallery_albums (slug, source, updated_at)
    VALUES ('${slug}', '${escaped}', datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      source = excluded.source,
      updated_at = datetime('now');
  `
  runWranglerSql(sql)
}

console.log('相册迁移完成。')
