#!/usr/bin/env node
/**
 * 将友链页 Markdown 写入 D1（`links_content` 表）。
 * 不再上传到 R2。
 *
 * 用法:
 *   pnpm migrate:links
 *   pnpm migrate:links:local
 *
 * 数据源优先级:
 *   content/links/index.md → pages/links/index.md
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const useLocal = process.argv.includes('--local')
const remoteFlag = useLocal ? '--local' : '--remote'

const candidates = [
  join(root, 'content', 'links', 'index.md'),
  join(root, 'pages', 'links', 'index.md'),
]

const sourcePath = candidates.find(path => existsSync(path))

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

if (!sourcePath) {
  console.error('未找到友链源文件，请创建 content/links/index.md')
  process.exit(1)
}

const source = readFileSync(sourcePath, 'utf8')
if (!source.includes('linkGroups') && !source.includes('\nlinks:')) {
  console.warn('警告: 源文件未包含 linkGroups，仍将上传页面配置。')
}

console.log(`写入友链文件: ${sourcePath} → D1 links_content (${useLocal ? 'local' : 'remote'})`)

const escaped = source.replace(/'/g, "''")
const sql = `
  INSERT INTO links_content (id, source, updated_at)
  VALUES (1, '${escaped}', datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    source = excluded.source,
    updated_at = datetime('now');
`
runWranglerSql(sql)

console.log('友链迁移完成。')
