-- 0007_r2_to_d1.sql
-- 将原本存放在 R2 的内容（文章 Markdown、HTML 静态页、关于页、友链页、相册）
-- 全部迁移到 D1 中存储，移除对 R2 的依赖。

-- 文章 Markdown 源码
ALTER TABLE posts ADD COLUMN source TEXT;

-- HTML 静态页内容
ALTER TABLE html_files ADD COLUMN content TEXT;

-- 关于页（单行，固定 id=1）
CREATE TABLE IF NOT EXISTS about_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 友链页（单行，固定 id=1）
CREATE TABLE IF NOT EXISTS links_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 相册中心（单行，固定 id=1）
CREATE TABLE IF NOT EXISTS gallery_hub (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 相册详情（每个相册一行）
CREATE TABLE IF NOT EXISTS gallery_albums (
  slug TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_albums_updated ON gallery_albums(updated_at DESC);
