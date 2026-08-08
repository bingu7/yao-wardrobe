// 测试点1: 旧版 Outfit 格式迁移 topId/bottomId/shoesId/bagId/accessoryId -> pieces
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

resetStorage()
store.set('privateWardrobeItems', [
  { id: 't1', name: '上衣', category: '上衣' },
  { id: 'b1', name: '下装', category: '下装' },
  { id: 's1', name: '鞋子', category: '鞋子' },
  { id: 'bag1', name: '包包', category: '包包' },
  { id: 'acc1', name: '配饰', category: '配饰' }
])
store.set('privateWardrobeOutfits', [
  {
    id: 'legacy-full',
    name: '全套旧格式',
    occasion: '通勤',
    topId: 't1',
    bottomId: 'b1',
    shoesId: 's1',
    bagId: 'bag1',
    accessoryId: 'acc1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'legacy-partial',
    name: '部分旧格式',
    topId: 't1',
    bottomId: 'b1'
  },
  {
    id: 'legacy-empty',
    name: '全空旧格式'
  },
  {
    id: 'modern',
    name: '新格式穿搭',
    pieces: [{ category: '上衣', itemId: 't1' }]
  }
])

const outfits = wardrobe.getOutfits()
const byId = (id) => outfits.find((o) => o.id === id)

// 1.1 五槽位全部迁移为 pieces，顺序与 legacySlotMap 一致（上衣/下装/鞋子/包包/配饰）
assert.deepStrictEqual(byId('legacy-full').pieces, [
  { category: '上衣', itemId: 't1' },
  { category: '下装', itemId: 'b1' },
  { category: '鞋子', itemId: 's1' },
  { category: '包包', itemId: 'bag1' },
  { category: '配饰', itemId: 'acc1' }
])
// 旧字段被剥离
for (const key of ['topId', 'bottomId', 'shoesId', 'bagId', 'accessoryId']) {
  assert.strictEqual(key in byId('legacy-full'), false, `旧字段 ${key} 应被移除`)
}

// 1.2 部分槽位迁移
assert.deepStrictEqual(byId('legacy-partial').pieces, [
  { category: '上衣', itemId: 't1' },
  { category: '下装', itemId: 'b1' }
])

// 1.3 空旧格式 -> 空 pieces
assert.deepStrictEqual(byId('legacy-empty').pieces, [])

// 1.4 新格式不受影响
assert.deepStrictEqual(byId('modern').pieces, [{ category: '上衣', itemId: 't1' }])

// 1.5 迁移结果已持久化回存储（API.md §12「回写 pieces」承诺）
const persisted = store.get('privateWardrobeOutfits')
const persistedLegacy = persisted.find((o) => o.id === 'legacy-full')
assert.ok(persistedLegacy && Array.isArray(persistedLegacy.pieces),
  '缺陷: getOutfits() 未将旧格式迁移结果回写存储, 存储仍为旧格式'
)
assert.strictEqual(persistedLegacy.pieces.length, 5)
assert.strictEqual('topId' in persistedLegacy, false)

// 1.6 混合：数组内同时存在新旧格式，只迁移旧格式
assert.strictEqual(persisted.find((o) => o.id === 'modern').pieces.length, 1)

// 1.7 引用不存在衣物的旧槽位 -> 迁移后 pieces 中该 piece 被剔除
store.set('privateWardrobeItems', [{ id: 't1', name: '上衣', category: '上衣' }])
store.set('privateWardrobeOutfits', [{
  id: 'legacy-dangling',
  name: '悬空引用',
  topId: 't1',
  bottomId: 'ghost'
}])
const dangling = wardrobe.getOutfit('legacy-dangling')
assert.deepStrictEqual(dangling.pieces, [{ category: '上衣', itemId: 't1' }])

// 1.8 category 跟随衣物实际分类自愈
store.set('privateWardrobeOutfits', [{
  id: 'legacy-cat',
  name: '分类自愈',
  topId: 't1'
}])
assert.deepStrictEqual(wardrobe.getOutfit('legacy-cat').pieces, [{ category: '上衣', itemId: 't1' }])

console.log('migration-1 legacy outfit: OK')
