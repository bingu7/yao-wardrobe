// 测试点4: 分类/场合/穿着统计自愈逻辑
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

// 4.1 首次 getCustomCategories：合并默认分类 + 旧缓存，去重回写
resetStorage()
store.delete('privateWardrobeCategoriesManaged')
store.set('privateWardrobeCustomCategories', ['自定义A', '上衣', ''])
const cats = wardrobe.getCustomCategories()
assert.ok(cats.includes('连衣裙'))
assert.ok(cats.includes('自定义A'))
assert.ok(cats.includes('上衣'))
assert.ok(!cats.includes(''))
assert.strictEqual(store.get('privateWardrobeCategoriesManaged'), true)

// 4.2 已管理后不再合并默认分类
resetStorage()
store.set('privateWardrobeCustomCategories', ['仅自定义'])
const cats2 = wardrobe.getCustomCategories()
assert.deepStrictEqual(cats2, ['仅自定义'])

// 4.3 首次 getCustomOccasions：合并默认场合 + 旧缓存 + 衣物中的场合
resetStorage()
store.delete('privateWardrobeOccasionsManaged')
store.set('privateWardrobeCustomOccasions', ['旧场合'])
store.set('privateWardrobeItems', [
  { id: 'x1', name: 'X', category: '上衣', occasions: ['衣物场合'] }
])
const occs = wardrobe.getCustomOccasions()
assert.ok(occs.includes('通勤'))
assert.ok(occs.includes('旧场合'))
assert.ok(occs.includes('衣物场合'))
assert.strictEqual(store.get('privateWardrobeOccasionsManaged'), true)

// 4.4 穿着统计自愈：setWearLog 后 wearCount/lastWornDate 自动修正
resetStorage()
store.set('privateWardrobeItems', [
  { id: 's1', name: '统计A', category: '上衣', wearCount: 99, lastWornDate: '2020-01-01' }
])
const log = wardrobe.setWearLog('2026-07-01', ['s1'])
assert.strictEqual(log.ok, true)
assert.strictEqual(wardrobe.getItem('s1').wearCount, 1)
assert.strictEqual(wardrobe.getItem('s1').lastWornDate, '2026-07-01')

// 4.5 删除穿着记录后统计回退
const log2 = wardrobe.setWearLog('2026-07-01', [])
assert.strictEqual(log2.ok, true)
assert.strictEqual(wardrobe.getItem('s1').wearCount, 0)
assert.strictEqual(wardrobe.getItem('s1').lastWornDate, '')

// 4.6 summarize 分类/场合/季节统计
const summary = wardrobe.summarize([
  { id: 'a1', name: 'A', category: '上衣', price: 100, wearCount: 2, occasions: ['通勤', '约会'], seasons: ['夏'] },
  { id: 'a2', name: 'B', category: '上衣', price: 300, wearCount: 0, occasions: ['通勤'], seasons: ['夏', '冬'] },
  { id: 'a3', name: 'C', category: '下装', price: 50, wearCount: 4, occasions: [], seasons: [] }
])
assert.strictEqual(summary.totalCount, 3)
assert.strictEqual(summary.totalPrice, 450)
assert.strictEqual(summary.averagePrice, 150)
assert.deepStrictEqual(summary.categoryCounts, [
  { category: '上衣', count: 2 },
  { category: '下装', count: 1 }
])
assert.deepStrictEqual(summary.seasonCounts, [
  { season: '夏', count: 2 },
  { season: '冬', count: 1 }
])
assert.deepStrictEqual(summary.occasionCounts, [
  { occasion: '通勤', count: 2 },
  { occasion: '约会', count: 1 }
])
assert.strictEqual(summary.totalWearCount, 6)
assert.strictEqual(summary.wornItemCount, 2)
assert.strictEqual(summary.mostWornItem.name, 'C')
assert.strictEqual(summary.averageCostPerWear, 25) // 穿过且有价衣物总价/总次数 = (100+50)/(2+4)

// 4.7 删除分类时衣物归入「其他」
resetStorage()
store.set('privateWardrobeItems', [
  { id: 'c1', name: '分类衣物', category: '上衣' }
])
store.set('privateWardrobeWishlist', [
  { id: 'cw1', name: '分类愿望', category: '上衣' }
])
const del = wardrobe.deleteCustomCategory('上衣')
assert.strictEqual(del.ok, true)
assert.strictEqual(wardrobe.getItem('c1').category, '其他')
assert.strictEqual(wardrobe.getWishlistItem('cw1').category, '其他')
// 「其他」不可删除
assert.strictEqual(wardrobe.deleteCustomCategory('其他').ok, false)

// 4.8 删除场合时从衣物移除、穿搭清空
resetStorage()
store.set('privateWardrobeItems', [
  { id: 'd1', name: '场合衣物', category: '上衣', occasions: ['通勤', '旅行'] }
])
store.set('privateWardrobeOutfits', [
  { id: 'do1', name: '场合穿搭', pieces: [{ category: '上衣', itemId: 'd1' }], occasion: '通勤' }
])
const delOcc = wardrobe.deleteCustomOccasion('通勤')
assert.strictEqual(delOcc.ok, true)
assert.deepStrictEqual(wardrobe.getItem('d1').occasions, ['旅行'])
assert.strictEqual(wardrobe.getOutfit('do1').occasion, '')

console.log('migration-4 stats self-heal: OK')
