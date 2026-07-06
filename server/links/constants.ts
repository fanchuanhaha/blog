export const LINKS_SINGLETON_ID = 1
export const LINKS_R2_KEY = 'links/index.md' // 已迁移到 D1，保留仅为兼容日志

export function linksLocalPath(root: string) {
  return `${root}/content/links/index.md`
}
