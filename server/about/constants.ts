export const ABOUT_SINGLETON_ID = 1
export const ABOUT_R2_KEY = 'about/index.md' // 已迁移到 D1，保留仅为兼容旧日志输出

export function aboutLocalPath(root: string) {
  return `${root}/content/about/index.md`
}
