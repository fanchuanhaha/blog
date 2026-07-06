export const GALLERY_HUB_SINGLETON_ID = 1
export const GALLERY_HUB_R2_KEY = 'gallery/index.md' // 已迁移到 D1，保留仅为兼容日志

export function galleryAlbumR2Key(slug: string) {
  return `gallery/${slug}/index.md`
}

export function galleryHubLocalPath(root: string) {
  return `${root}/content/gallery/index.md`
}

export function galleryAlbumLocalPath(root: string, slug: string) {
  return `${root}/content/gallery/${slug}/index.md`
}

export function isValidGallerySlug(slug: string) {
  return /^[a-z0-9][a-z0-9-]*$/i.test(slug)
}
