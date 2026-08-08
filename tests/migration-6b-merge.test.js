// 测试点6b: 合并策略 - 穿搭/计划/穿着记录/分类场合
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

// 6b.1 穿搭按较新 updatedAt 合并
resetStorage()
store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣' }])
store.set('privateWardrobeOutfits', [{
  id: 'o1', name: '本地穿搭', pieces: [{ category: '上衣', itemId: 'i1' }],
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z'
}])
wardrobe.importData({
  items: [{ id: 'i1', name: 'A', category: '上衣' }],
  outfits: [{
    id: 'o1', name: '备份穿搭', pieces: [{ category: '上衣', itemId: 'i1' }],
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-12T00:00:00.000Z'
  }],
  wishlist: []
})
assert.strictEqual(wardrobe.getOutfit('o1').name, '备份穿搭')

// 6b.2 穿搭计划：备份较新覆盖，本地较新保留
resetStorage()
store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣' }])
store.set('privateWardrobeOutfits', [{
  id: 'o1', name: '穿搭', pieces: [{ category: '上衣', itemId: 'i1' }]
}])
store.set('privateWardrobeOutfitPlans', {
  '2026-07-10': { outfitId: 'o1', note: '本地计划', createdAt: 'x', updatedAt: '2026-07-09T00:00:00.000Z' }
})
wardrobe.importData({
  items: [{ id: 'i1', name: 'A', category: '上衣' }],
  outfits: [{ id: 'o1', name: '穿搭', pieces: [{ category: '上衣', itemId: 'i1' }] }],
  wishlist: [],
  outfitPlans: {
    '2026-07-10': { outfitId: 'o1', note: '备份计划新', createdAt: 'x', updatedAt: '2026-07-11T00:00:00.000Z' }
  }
})
assert.strictEqual(wardrobe.getOutfitPlan('2026-07-10').note, '备份计划新')

// 6b.3 穿着记录取并集
resetStorage()
store.set('privateWardrobeItems', [
  { id: 'w1', name: '甲', category: '上衣' },
  { id: 'w2', name: '乙', category: '下装' }
])
store.set('privateWardrobeWearLogs', { '2026-07-01': ['w1'] })
wardrobe.importData({
  items: [
    { id: 'w1', name: '甲', category: '上衣' },
    { id: 'w2', name: '乙', category: '下装' }
  ],
  outfits: [],
  wishlist: [],
  wearLogs: { '2026-07-01': ['w2'], '2026-07-02': ['w1'] }
})
assert.deepStrictEqual(wardrobe.getWearLog('2026-07-01'), ['w1', 'w2'])
assert.deepStrictEqual(wardrobe.getWearLog('2026-07-02'), ['w1'])
// 合并后 wearCount 自愈：w1 穿了 2 天，w2 穿了 1 天
assert.strictEqual(wardrobe.getItem('w1').wearCount, 2)
assert.strictEqual(wardrobe.getItem('w2').wearCount, 1)

// 6b.4 分类/场合取并集
resetStorage()
store.set('privateWardrobeCustomCategories', ['本地分类'])
store.set('privateWardrobeCustomOccasions', ['本地场合'])
wardrobe.importData({
  items: [], outfits: [], wishlist: [],
  categories: ['备份分类'], occasions: ['备份场合']
})
const cats = wardrobe.getCustomCategories()
const occs = wardrobe.getCustomOccasions()
assert.ok(cats.includes('本地分类') && cats.includes('备份分类') && cats.includes('其他'))
assert.ok(occs.includes('本地场合') && occs.includes('备份场合'))

// 6b.5 未来日期的穿着记录被过滤
resetStorage()
const future = new Date()
future.setDate(future.getDate() + 5)
const futureDate = wardrobe.formatLocalDate(future)
store.set('privateWardrobeItems', [{ id: 'f1', name: '未来', category: '上衣' }])
wardrobe.importData({
  items: [{ id: 'f1', name: '未来', category: '上衣' }],
  outfits: [], wishlist: [],
  wearLogs: { [futureDate]: ['f1'] }
})
assert.deepStrictEqual(wardrobe.getWearLog(futureDate), [])

console.log('migration-6b merge strategy (outfits/plans/logs): OK')
