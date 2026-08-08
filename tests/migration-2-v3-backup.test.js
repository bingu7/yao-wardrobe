// 测试点2: v3 备份导出/导入
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

resetStorage()
store.set('privateWardrobeItems', [
  { id: 'i1', name: '衣物A', category: '上衣', price: 50, imageUrl: 'saved://old', wearCount: 3, lastWornDate: '2026-07-01' }
])
store.set('privateWardrobeOutfits', [
  { id: 'o1', name: '穿搭1', pieces: [{ category: '上衣', itemId: 'i1' }], occasion: '通勤' }
])
store.set('privateWardrobeWishlist', [
  { id: 'w1', name: '愿望1', category: '鞋子', imageUrl: 'saved://old' }
])
store.set('privateWardrobeWearLogs', { '2026-07-01': ['i1'], '2026-07-02': ['i1'] })
store.set('privateWardrobeOutfitPlans', {
  '2026-07-10': { outfitId: 'o1', note: '上班', createdAt: '2026-07-09T00:00:00.000Z', updatedAt: '2026-07-09T00:00:00.000Z' }
})

// 2.1 导出版本为 3，imageUrl 被置空
const backup = wardrobe.exportData()
assert.strictEqual(backup.version, 3)
assert.ok(backup.exportedAt)
assert.strictEqual(backup.items[0].imageUrl, '')
assert.strictEqual(backup.wishlist[0].imageUrl, '')
assert.strictEqual(backup.items[0].wearCount, 3)
assert.deepStrictEqual(backup.outfits[0].pieces, [{ category: '上衣', itemId: 'i1' }])
assert.deepStrictEqual(backup.wearLogs, { '2026-07-01': ['i1'], '2026-07-02': ['i1'] })
assert.ok(backup.outfitPlans['2026-07-10'])
assert.deepStrictEqual(backup.categories, ['上衣', '下装', '其他'])
assert.deepStrictEqual(backup.occasions, ['通勤', '旅行'])
// 不包含 images 字段
assert.strictEqual(backup.images, undefined)

// 2.2 JSON 字符串导入可用
resetStorage()
store.set('privateWardrobeItems', [{ id: 'local', name: '本地', category: '上衣' }])
const jsonStr = JSON.stringify(backup)
const result = wardrobe.importData(jsonStr)
assert.strictEqual(result.ok, true)
assert.strictEqual(result.count, 1)
assert.strictEqual(result.merged, true)

// 2.3 导入后数据完整：items/outfits/wishlist/wearLogs/plans
assert.strictEqual(wardrobe.getItem('i1').name, '衣物A')
assert.strictEqual(wardrobe.getItem('i1').imageUrl, '') // v3 无图片
// 导入后按 wearLogs 修正统计（API.md §15），此处不再断言备份原值 3
assert.strictEqual(wardrobe.getOutfit('o1').pieces[0].itemId, 'i1')
assert.strictEqual(wardrobe.getWishlistItem('w1').name, '愿望1')
assert.deepStrictEqual(wardrobe.getWearLog('2026-07-01'), ['i1'])
assert.strictEqual(wardrobe.getOutfitPlan('2026-07-10').outfitId, 'o1')

// 2.4 穿着统计自愈：wearLogs 有 2 天记录，wearCount 应为 2（若导入时本地有日志）
// 注：import 后本地为空，count 应为 2
const imported = wardrobe.getItem('i1')
assert.strictEqual(imported.wearCount, 2)
assert.strictEqual(imported.lastWornDate, '2026-07-02')

// 2.5 无效备份被拒绝
assert.strictEqual(wardrobe.importData('not json').ok, false)
assert.strictEqual(wardrobe.importData('{}').ok, false)
assert.strictEqual(wardrobe.importData({ items: 'x', outfits: [], wishlist: [] }).ok, false)
assert.strictEqual(wardrobe.importData({ items: [{ id: '' }], outfits: [], wishlist: [] }).ok, false)
assert.strictEqual(wardrobe.importData({ items: [], outfits: [], wishlist: [], wearLogs: [] }).ok, false)
assert.strictEqual(wardrobe.importData({ items: [], outfits: [], wishlist: [], wearLogs: { 'bad-date': ['x'] } }).ok, false)

console.log('migration-2 v3 backup: OK')
