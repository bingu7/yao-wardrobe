// 测试点6a: 合并策略 - 较新记录覆盖较旧记录
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

function makeItem(id, name, category, updatedAt) {
  return { id, name, category, updatedAt }
}

// 6.1 备份记录较新 -> 覆盖本地
resetStorage()
store.set('privateWardrobeItems', [makeItem('m1', '本地名', '上衣', '2026-07-01T00:00:00.000Z')])
const r1 = wardrobe.importData({
  items: [makeItem('m1', '备份名', '下装', '2026-07-02T00:00:00.000Z')],
  outfits: [], wishlist: []
})
assert.strictEqual(r1.ok, true)
assert.strictEqual(wardrobe.getItem('m1').name, '备份名')
assert.strictEqual(wardrobe.getItem('m1').category, '下装')

// 6.2 本地记录较新 -> 保留本地（不覆盖）
resetStorage()
store.set('privateWardrobeItems', [makeItem('m2', '本地新', '上衣', '2026-07-05T00:00:00.000Z')])
const r2 = wardrobe.importData({
  items: [makeItem('m2', '备份旧', '下装', '2026-07-01T00:00:00.000Z')],
  outfits: [], wishlist: []
})
assert.strictEqual(r2.ok, true)
assert.strictEqual(wardrobe.getItem('m2').name, '本地新')
assert.strictEqual(wardrobe.getItem('m2').category, '上衣')

// 6.3 时间相同 -> 保留本地
resetStorage()
store.set('privateWardrobeItems', [makeItem('m3', '本地', '上衣', '2026-07-03T00:00:00.000Z')])
const r3 = wardrobe.importData({
  items: [makeItem('m3', '备份', '下装', '2026-07-03T00:00:00.000Z')],
  outfits: [], wishlist: []
})
assert.strictEqual(r3.ok, true)
assert.strictEqual(wardrobe.getItem('m3').name, '本地')

// 6.4 无 updatedAt 视为 0 -> 本地（有 updatedAt）保留
resetStorage()
store.set('privateWardrobeItems', [makeItem('m4', '本地', '上衣', '2026-07-03T00:00:00.000Z')])
const r4 = wardrobe.importData({
  items: [{ id: 'm4', name: '无时间备份', category: '下装' }],
  outfits: [], wishlist: []
})
assert.strictEqual(r4.ok, true)
assert.strictEqual(wardrobe.getItem('m4').name, '本地')

// 6.5 新 ID 直接并入
resetStorage()
store.set('privateWardrobeItems', [makeItem('local-only', '本地', '上衣', '2026-07-03T00:00:00.000Z')])
const r5 = wardrobe.importData({
  items: [makeItem('remote-only', '备份', '下装', '2026-07-03T00:00:00.000Z')],
  outfits: [], wishlist: []
})
assert.strictEqual(r5.ok, true)
assert.strictEqual(wardrobe.getItems().length, 2)
assert.ok(wardrobe.getItem('remote-only'))

console.log('migration-6a merge strategy (newer wins): OK')
