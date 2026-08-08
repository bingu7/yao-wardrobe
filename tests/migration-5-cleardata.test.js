// 测试点5: clearAllData 数据清除后重置
const assert = require('assert')
const { store, wardrobe, resetStorage, removedFiles, unlinkedFiles } = require('./_mock')

resetStorage()
// 用户数据路径下的图片走 unlink；saved:// 走 removeSavedFile
store.set('privateWardrobeItems', [
  { id: 'k1', name: '衣物1', category: '上衣', imageUrl: 'saved://old' },
  { id: 'k2', name: '衣物2', category: '下装', imageUrl: 'wxfile://usr/wardrobe-images/x.jpg' }
])
store.set('privateWardrobeWishlist', [
  { id: 'kw1', name: '愿望1', category: '鞋子', imageUrl: 'saved://old' }
])
store.set('privateWardrobeOutfits', [
  { id: 'ko1', name: '穿搭1', pieces: [{ category: '上衣', itemId: 'k1' }] }
])
store.set('privateWardrobeWearLogs', { '2026-07-01': ['k1'] })
store.set('privateWardrobeOutfitPlans', {
  '2026-07-10': { outfitId: 'ko1', note: '', createdAt: 'x', updatedAt: 'x' }
})
store.set('privateWardrobeCustomCategories', ['自定义'])
store.set('privateWardrobeCustomOccasions', ['自定义场合'])

const result = wardrobe.clearAllData()
assert.strictEqual(result.ok, true)

// 5.1 业务数据清空
assert.deepStrictEqual(wardrobe.getItems(), [])
assert.deepStrictEqual(wardrobe.getOutfits(), [])
assert.deepStrictEqual(wardrobe.getWishlist(), [])
assert.deepStrictEqual(wardrobe.getWearLogs(), {})
assert.deepStrictEqual(wardrobe.getOutfitPlans(), {})

// 5.2 分类/场合重置为默认值
assert.deepStrictEqual(wardrobe.getCustomCategories(), wardrobe.defaultCategories)
assert.deepStrictEqual(wardrobe.getCustomOccasions(), wardrobe.defaultOccasions)

// 5.3 图片文件被清理：saved://old 走 removeSavedFile，user 路径走 unlink
assert.ok(removedFiles.includes('saved://old'))
assert.ok(unlinkedFiles.includes('wxfile://usr/wardrobe-images/x.jpg'))

// 5.4 清理后可正常重新写入
const newId = wardrobe.upsertItem({ name: '新衣物', category: '上衣' })
assert.ok(newId)
assert.strictEqual(wardrobe.getItem(newId).name, '新衣物')

// 5.5 清除后再次清除幂等
assert.strictEqual(wardrobe.clearAllData().ok, true)
assert.deepStrictEqual(wardrobe.getItems(), [])

console.log('migration-5 clearAllData: OK')
