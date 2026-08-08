// 测试点7: 空缓存/损坏缓存恢复
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

// 7.1 空存储（无任何缓存键）：首次读取应自愈为空数组/空对象
resetStorage()
store.clear()
assert.deepStrictEqual(wardrobe.getItems(), [])
assert.deepStrictEqual(wardrobe.getOutfits(), [])
assert.deepStrictEqual(wardrobe.getWishlist(), [])
assert.deepStrictEqual(wardrobe.getWearLogs(), {})
assert.deepStrictEqual(wardrobe.getOutfitPlans(), {})
// 自愈回写后再次读取仍为空
assert.deepStrictEqual(wardrobe.getItems(), [])

// 7.2 衣物缓存为非数组（损坏）：getItems 自愈为 []
resetStorage()
store.set('privateWardrobeItems', '{"broken":true}')
assert.deepStrictEqual(wardrobe.getItems(), [])
assert.deepStrictEqual(store.get('privateWardrobeItems'), [])

// 7.3 衣物缓存为 null
resetStorage()
store.set('privateWardrobeItems', null)
assert.deepStrictEqual(wardrobe.getItems(), [])

// 7.4 穿搭缓存为对象（损坏）：getOutfits 自愈为 []
resetStorage()
store.set('privateWardrobeOutfits', { broken: true })
assert.deepStrictEqual(wardrobe.getOutfits(), [])
assert.deepStrictEqual(store.get('privateWardrobeOutfits'), [])

// 7.5 穿搭缓存包含混合损坏项：非对象项被剔除，合法项保留并回写
resetStorage()
store.set('privateWardrobeItems', [{ id: 'ok', name: '正常', category: '上衣' }])
store.set('privateWardrobeOutfits', [
  { id: 'good', name: '合法穿搭', pieces: [{ category: '上衣', itemId: 'ok' }] },
  null,
  'string-garbage',
  42,
  { id: 'bad', name: '引用丢失', pieces: [{ category: '上衣', itemId: 'ghost' }] }
])
const outfits = wardrobe.getOutfits()
const ids = outfits.map((o) => o.id)
assert.ok(ids.includes('good'))
// 引用丢失的穿搭保留（pieces 清空），与 wardrobe.test.js 既有契约一致：不丢弃用户数据
assert.ok(ids.includes('bad'), '引用丢失的穿搭应保留而非剔除')
assert.strictEqual(outfits.length, 2)
assert.deepStrictEqual(outfits.find((o) => o.id === 'bad').pieces, [], 'bad 的引用丢失 piece 应被剔除')
// 回写清理后的数据：非对象项被剔除，合法项保留
const persisted = store.get('privateWardrobeOutfits')
assert.strictEqual(persisted.length, 2)

// 7.6 穿着记录损坏（数组）：自愈为 {}
resetStorage()
store.set('privateWardrobeWearLogs', ['not-a-map'])
assert.deepStrictEqual(wardrobe.getWearLogs(), {})

// 7.7 穿着记录含非法日期和非法值：getOutfitPlans 自愈
resetStorage()
store.set('privateWardrobeItems', [{ id: 'ok', name: '正常', category: '上衣' }])
store.set('privateWardrobeOutfits', [{
  id: 'good', name: '合法', pieces: [{ category: '上衣', itemId: 'ok' }]
}])
store.set('privateWardrobeOutfitPlans', {
  '2026-07-10': { outfitId: 'good', note: '合法', createdAt: 'x', updatedAt: 'x' },
  'bad-date': { outfitId: 'good' },
  '2026-07-11': { note: '缺 outfitId' },
  '2026-07-12': { outfitId: 'ghost-outfit' }
})
const plans = wardrobe.getOutfitPlans()
assert.deepStrictEqual(Object.keys(plans), ['2026-07-10'])
// 损坏项被剔除并回写
assert.deepStrictEqual(Object.keys(store.get('privateWardrobeOutfitPlans')), ['2026-07-10'])

// 7.8 愿望单缓存损坏（非数组）：自愈为 []
resetStorage()
store.set('privateWardrobeWishlist', 'garbage')
assert.deepStrictEqual(wardrobe.getWishlist(), [])

// 7.9 愿望单 matchItemId 引用丢失：自愈置空
resetStorage()
store.set('privateWardrobeItems', [{ id: 'real', name: '真实', category: '上衣' }])
store.set('privateWardrobeWishlist', [
  { id: 'wish1', name: '有效愿望', category: '鞋子', matchItemId: 'real' },
  { id: 'wish2', name: '悬空愿望', category: '鞋子', matchItemId: 'ghost' }
])
const wishlist = wardrobe.getWishlist()
assert.strictEqual(wishlist.find((w) => w.id === 'wish1').matchItemId, 'real')
assert.strictEqual(wishlist.find((w) => w.id === 'wish2').matchItemId, '')

console.log('migration-7 empty/corrupt cache recovery: OK')
