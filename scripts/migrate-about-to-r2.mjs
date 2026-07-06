#!/usr/bin/env node
/**
 * 将关于页 Markdown 写入 D1（`about_content` 表）。
 * 不再上传到 R2。
 *
 * 用法:
 *   pnpm migrate:about
 *   pnpm migrate:about:local
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const useLocal = process.argv.includes('--local')
const remoteFlag = useLocal ? '--local' : '--remote'

const candidates = [
  join(root, 'content', 'about', 'index.md'),
  join(root, 'pages', 'about', 'index.md'),
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
  console.error('未找到关于页源文件，请创建 content/about/index.md')
  process.exit(1)
}

const source = readFileSync(sourcePath, 'utf8')
console.log(`写入关于页: ${sourcePath} → D1 about_content (${useLocal ? 'local' : 'remote'})`)

const escaped = source.replace(/'/g, "''")
const sql = `
  INSERT INTO about_content (id, source, updated_at)
  VALUES (1, '${escaped}', datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    source = excluded.source,
    updated_at = datetime('now');
`
runWranglerSql(sql)

console.log('关于页迁移完成。')
