// 测试点3: v4 带图片备份导出/导入
const assert = require('assert')
const { store, wardrobe, resetStorage, fileContents } = require('./_mock')

// 3.1 导出：图片被读取为 base64，imageUrl 置空，imageRef 去重共享
resetStorage()
fileContents.set('saved://a.jpg', 'QUFBQUJBPT0=') // base64 'AAAABA=='
store.set('privateWardrobeItems', [
  { id: 'p1', name: '图1', category: '上衣', imageUrl: 'saved://a.jpg', updatedAt: '2026-07-01T00:00:00.000Z' },
  { id: 'p2', name: '图2', category: '下装', imageUrl: 'saved://a.jpg', updatedAt: '2026-07-01T00:00:00.000Z' }
])
store.set('privateWardrobeWishlist', [
  { id: 'pw1', name: '图愿望', category: '鞋子', imageUrl: 'saved://a.jpg', updatedAt: '2026-07-01T00:00:00.000Z' }
])

wardrobe.exportDataWithImages().then((imageBackup) => {
  assert.strictEqual(imageBackup.version, 4)
  assert.strictEqual(Object.keys(imageBackup.images).length, 1)
  const ref = imageBackup.items[0].imageRef
  assert.ok(ref && typeof ref === 'string')
  // 共享图片只导出一份
  assert.strictEqual(imageBackup.items[1].imageRef, ref)
  assert.strictEqual(imageBackup.wishlist[0].imageRef, ref)
  // imageUrl 置空
  assert.strictEqual(imageBackup.items[0].imageUrl, '')
  // base64 内容保留
  assert.strictEqual(imageBackup.images[ref].data, 'QUFBQUJBPT0=')
  assert.strictEqual(imageBackup.images[ref].extension, 'jpg')

  // 3.2 导入：写回 wardrobe-images，imageRef 替换为本地路径
  resetStorage()
  store.set('privateWardrobeItems', [])
  return wardrobe.importDataWithImages(imageBackup).then((result) => {
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.imageCount, 1)
    const item1 = wardrobe.getItem('p1')
    const item2 = wardrobe.getItem('p2')
    assert.ok(item1.imageUrl.startsWith('wxfile://usr/wardrobe-images/restore-'))
    assert.strictEqual(item1.imageUrl, item2.imageUrl)
    assert.strictEqual(wardrobe.getWishlistItem('pw1').imageUrl, item1.imageUrl)
    // 无 imageRef 残留
    assert.strictEqual(item1.imageRef, undefined)
    return null
  })
}).then(() => {
  // 3.3 损坏图片内容：base64 无效应报错
  resetStorage()
  store.set('privateWardrobeItems', [])
  const bad = {
    version: 4,
    items: [{ id: 'x1', name: '坏图', imageUrl: '', imageRef: 'r1' }],
    outfits: [],
    wishlist: [],
    images: { r1: { extension: 'jpg', data: '!!!not-base64!!!' } }
  }
  return wardrobe.importDataWithImages(bad).then((result) => {
    assert.strictEqual(result.ok, false)
    assert.ok(result.message.includes('图片'))
  })
}).then(() => {
  // 3.4 v4 备份用 importData（无图片恢复）应被拒绝
  resetStorage()
  const v4backup = {
    version: 4,
    items: [{ id: 'y1', name: '带图', imageUrl: '', imageRef: 'r2' }],
    outfits: [],
    wishlist: [],
    images: { r2: { extension: 'jpg', data: 'QUFBQUJBPT0=' } }
  }
  const rejected = wardrobe.importData(v4backup)
  assert.strictEqual(rejected.ok, false)
  assert.ok(rejected.message.includes('图片'))
  console.log('migration-3 v4 backup: OK')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
