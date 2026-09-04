// 核心数据层 API 回归测试（覆盖 wardrobe.js 全部 70 个导出项）
// 运行: node tests/regression.test.js
// 设计: 每个 API 至少覆盖 正常路径 / 边界 / 异常（空输入、null、类型错误）
const assert = require('assert')
const { store, removedFiles, unlinkedFiles, fileContents, wardrobe, resetStorage } = require('./_mock')

let passed = 0
let failed = 0
const failures = []
const SKIP = []

function test(name, fn) {
  try {
    fn()
    passed += 1
  } catch (error) {
    failed += 1
    failures.push({ name, message: error.message, stack: error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : '' })
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    passed += 1
  } catch (error) {
    failed += 1
    failures.push({ name, message: error.message, stack: error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : '' })
  }
}

function throws(fn, label) {
  try {
    fn()
  } catch (error) {
    return error
  }
  throw new Error(`期望抛出异常但未抛出: ${label}`)
}

// ============ 1. 常量导出 ============
test('常量: defaultCategories 默认 9 分类', () => {
  assert.deepStrictEqual(wardrobe.defaultCategories, ['连衣裙', '上衣', '下装', '外套', '鞋子', '包包', '帽子/发饰', '配饰', '其他'])
})
test('常量: seasons 四季', () => {
  assert.deepStrictEqual(wardrobe.seasons, ['春', '夏', '秋', '冬'])
})
test('常量: statuses 三种状态', () => {
  assert.deepStrictEqual(wardrobe.statuses, ['常穿', '偶尔穿', '闲置'])
})
test('常量: defaultOccasions 默认场合', () => {
  assert.deepStrictEqual(wardrobe.defaultOccasions, ['通勤', '约会', '旅行', '拍照', '正式', '休闲', '运动'])
})
test('常量: IDLE_ALERT_DAYS = 60', () => {
  assert.strictEqual(wardrobe.IDLE_ALERT_DAYS, 60)
})

// ============ 2. 分类管理 ============
test('getCustomCategories: 首次调用迁移默认+自定义', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getCustomCategories(), ['上衣', '下装', '其他'])
})
test('getCustomCategories: 已托管后损坏存储返回 []（设计行为，不自动迁移）', () => {
  resetStorage()
  store.set('privateWardrobeCustomCategories', 'not-array')
  assert.deepStrictEqual(wardrobe.getCustomCategories(), [])
})
test('getFormCategories 与 getCustomCategories 一致', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getFormCategories(), wardrobe.getCustomCategories())
})
test('getCategories: 返回 全部 + 去重衣物分类', () => {
  resetStorage()
  const items = [
    { category: '上衣' },
    { category: '上衣' },
    { category: '鞋子' },
    { category: '' }
  ]
  assert.deepStrictEqual(wardrobe.getCategories(items), ['全部', '上衣', '鞋子'])
})
test('getCategories: 空数组', () => {
  assert.deepStrictEqual(wardrobe.getCategories([]), ['全部'])
})
test('addCustomCategory: 正常添加', () => {
  resetStorage()
  const result = wardrobe.addCustomCategory('运动装')
  assert.strictEqual(result.ok, true)
  assert.ok(wardrobe.getCustomCategories().includes('运动装'))
})
test('addCustomCategory: 空输入拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.addCustomCategory('').ok, false)
  assert.strictEqual(wardrobe.addCustomCategory(null).ok, false)
  assert.strictEqual(wardrobe.addCustomCategory(undefined).ok, false)
})
test('addCustomCategory: 重复分类拒绝', () => {
  resetStorage()
  wardrobe.addCustomCategory('运动装')
  assert.strictEqual(wardrobe.addCustomCategory('运动装').ok, false)
})
test('addCustomCategory: 输入非字符串容忍（数字转字符串）', () => {
  resetStorage()
  const result = wardrobe.addCustomCategory(123)
  assert.strictEqual(result.ok, true)
  assert.ok(wardrobe.getCustomCategories().includes('123'))
})
test('renameCustomCategory: 正常重命名并同步衣物/愿望', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: 'W', category: '上衣' }])
  const result = wardrobe.renameCustomCategory('上衣', '上装')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(wardrobe.getItem('i1').category, '上装')
  assert.strictEqual(wardrobe.getWishlistItem('w1').category, '上装')
})
test('renameCustomCategory: 空参数拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.renameCustomCategory('', '新').ok, false)
  assert.strictEqual(wardrobe.renameCustomCategory('旧', '').ok, false)
})
test('renameCustomCategory: 其他/全部保护', () => {
  resetStorage()
  assert.strictEqual(wardrobe.renameCustomCategory('其他', '兜底').ok, false)
  assert.strictEqual(wardrobe.renameCustomCategory('上衣', '全部').ok, false)
})
test('renameCustomCategory: 重名拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.renameCustomCategory('上衣', '下装').ok, false)
})
test('deleteCustomCategory: 正常删除并归入其他', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: 'W', category: '上衣' }])
  const result = wardrobe.deleteCustomCategory('上衣')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(wardrobe.getItem('i1').category, '其他')
  assert.strictEqual(wardrobe.getWishlistItem('w1').category, '其他')
})
test('deleteCustomCategory: 其他不可删除/空输入', () => {
  resetStorage()
  assert.strictEqual(wardrobe.deleteCustomCategory('其他').ok, false)
  assert.strictEqual(wardrobe.deleteCustomCategory(null).ok, false)
})
test('moveCustomCategory: 正常上移/下移', () => {
  resetStorage()
  wardrobe.moveCustomCategory('下装', -1)
  assert.deepStrictEqual(wardrobe.getCustomCategories(), ['下装', '上衣', '其他'])
})
test('moveCustomCategory: 越界拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.moveCustomCategory('上衣', -1).ok, false)
  assert.strictEqual(wardrobe.moveCustomCategory('其他', 1).ok, false)
  assert.strictEqual(wardrobe.moveCustomCategory('不存在', 0).ok, false)
})
test('buildCategoryPanelItems: 构建面板条目', () => {
  resetStorage()
  const items = wardrobe.buildCategoryPanelItems(['上衣', '下装'], ['上衣', '下装', '其他'], '下装')
  assert.strictEqual(items.length, 2)
  assert.strictEqual(items[1].selected, true)
  assert.strictEqual(items[0].canMoveUp, false)
  assert.strictEqual(items[0].canMoveDown, true)
})

// ============ 3. 场合管理 ============
test('getOccasions 与 getCustomOccasions 一致', () => {
  resetStorage()
  wardrobe.addCustomOccasion('派对')
  assert.deepStrictEqual(wardrobe.getOccasions(), wardrobe.getCustomOccasions())
  assert.ok(wardrobe.getOccasions().includes('派对'))
})
test('getCustomOccasions: 首次调用迁移默认场合', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getCustomOccasions(), ['通勤', '旅行'])
})
test('addCustomOccasion: 正常/空/重复', () => {
  resetStorage()
  assert.strictEqual(wardrobe.addCustomOccasion('聚会').ok, true)
  assert.strictEqual(wardrobe.addCustomOccasion('').ok, false)
  assert.strictEqual(wardrobe.addCustomOccasion('聚会').ok, false)
  assert.strictEqual(wardrobe.addCustomOccasion(null).ok, false)
})
test('deleteCustomOccasion: 删除并同步衣物/穿搭', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: ['旅行'], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', occasion: '旅行', pieces: [] }])
  const result = wardrobe.deleteCustomOccasion('旅行')
  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(wardrobe.getItem('i1').occasions, [])
  assert.strictEqual(wardrobe.getOutfit('o1').occasion, '')
})
test('renameCustomOccasion: 重命名并同步', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: ['旅行'], seasons: [] }])
  wardrobe.renameCustomOccasion('旅行', '度假')
  assert.deepStrictEqual(wardrobe.getItem('i1').occasions, ['度假'])
  assert.ok(wardrobe.getCustomOccasions().includes('度假'))
})
test('moveCustomOccasion: 正常/越界', () => {
  resetStorage()
  assert.strictEqual(wardrobe.moveCustomOccasion('旅行', -1).ok, true)
  assert.strictEqual(wardrobe.moveCustomOccasion('旅行', -5).ok, false)
  assert.strictEqual(wardrobe.moveCustomOccasion('不存在', 1).ok, false)
})
test('buildCustomView: 展开/收起逻辑', () => {
  resetStorage()
  const view = wardrobe.buildCustomView(['a', 'b', 'c', 'd'], false, 2)
  assert.deepStrictEqual(view.visibleItems, ['a', 'b'])
  assert.strictEqual(view.hiddenCount, 2)
  assert.strictEqual(view.toggleText, '展开 2 个')
  const expanded = wardrobe.buildCustomView(['a', 'b', 'c', 'd'], true, 2)
  assert.strictEqual(expanded.visibleItems.length, 4)
  assert.strictEqual(expanded.toggleText, '收起')
})

// ============ 4. 工具函数 ============
test('formatLocalDate: 正常/边界', () => {
  assert.strictEqual(wardrobe.formatLocalDate(new Date(2026, 6, 1)), '2026-07-01')
  assert.strictEqual(wardrobe.formatLocalDate(new Date(2026, 0, 5)), '2026-01-05')
})
test('formatLocalDate: 非法输入返回空串', () => {
  assert.strictEqual(wardrobe.formatLocalDate(null), '')
  assert.strictEqual(wardrobe.formatLocalDate(new Date('invalid')), '')
  assert.strictEqual(wardrobe.formatLocalDate('2026-07-01'), '')
})
test('getCurrentSeason: 月份映射', () => {
  assert.strictEqual(wardrobe.getCurrentSeason(new Date(2026, 2, 1)), '春')
  assert.strictEqual(wardrobe.getCurrentSeason(new Date(2026, 6, 1)), '夏')
  assert.strictEqual(wardrobe.getCurrentSeason(new Date(2026, 9, 1)), '秋')
  assert.strictEqual(wardrobe.getCurrentSeason(new Date(2026, 11, 1)), '冬')
  assert.strictEqual(wardrobe.getCurrentSeason(new Date(2026, 1, 1)), '冬')
})
test('createDebounce: 防抖合并多次调用', async () => {
  const debounced = wardrobe.createDebounce(20)
  let count = 0
  await new Promise((resolve) => {
    debounced(() => { count += 1 })
    debounced(() => { count += 1 })
    debounced(() => { count += 1 })
    setTimeout(() => {
      assert.strictEqual(count, 1)
      resolve()
    }, 60)
  })
})

// ============ 5. 衣物 CRUD ============
test('getItems: 空存储初始化返回 []', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getItems(), [])
})
test('getItems: 存储为对象时重置为 []', () => {
  resetStorage()
  store.set('privateWardrobeItems', { bad: true })
  assert.deepStrictEqual(wardrobe.getItems(), [])
})
test('upsertItem: 无 id 创建并生成唯一 id', () => {
  resetStorage()
  const id = wardrobe.upsertItem({ name: '白衬衫', category: '上衣', price: 99 })
  assert.ok(id.startsWith('item_'))
  const item = wardrobe.getItem(id)
  assert.strictEqual(item.name, '白衬衫')
  assert.strictEqual(item.category, '上衣')
  assert.ok(item.createdAt)
  assert.ok(item.updatedAt)
  assert.deepStrictEqual(item.occasions, [])
  assert.deepStrictEqual(item.seasons, [])
})
test('upsertItem: 指定 id 新增', () => {
  resetStorage()
  const id = wardrobe.upsertItem({ id: 'fixed', name: 'A', category: '上衣' })
  assert.strictEqual(id, 'fixed')
})
test('upsertItem: 更新已有衣物保留 createdAt', () => {
  resetStorage()
  const id = wardrobe.upsertItem({ id: 'fixed', name: '旧名', category: '上衣' })
  const before = wardrobe.getItem(id).createdAt
  wardrobe.upsertItem({ id: 'fixed', name: '新名', category: '下装' })
  const after = wardrobe.getItem(id)
  assert.strictEqual(after.name, '新名')
  assert.strictEqual(after.category, '下装')
  assert.strictEqual(after.createdAt, before)
})
test('upsertItem: 更新后触发穿搭引用同步', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [{ category: '旧分类', itemId: 'i1' }] }])
  wardrobe.upsertItem({ id: 'i1', name: 'A2', category: '下装' })
  // 穿搭中 category 应自愈为下装
  assert.strictEqual(wardrobe.getOutfit('o1').pieces[0].category, '下装')
})
test('upsertItem: null 输入抛出类型错误（调用方契约）', () => {
  resetStorage()
  const error = throws(() => wardrobe.upsertItem(null), 'upsertItem(null)')
  assert.ok(error instanceof TypeError)
})
test('getItem: 存在返回规范化对象', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', wearCount: '3' }])
  const item = wardrobe.getItem('i1')
  assert.strictEqual(item.wearCount, 3)
  assert.strictEqual(item.lastWornDate, '')
})
test('getItem: 不存在/空 id 返回 null', () => {
  resetStorage()
  assert.strictEqual(wardrobe.getItem('nope'), null)
  assert.strictEqual(wardrobe.getItem(''), null)
  assert.strictEqual(wardrobe.getItem(null), null)
})
test('deleteItem: 删除并级联清理穿搭/愿望/日志', () => {
  resetStorage()
  store.set('privateWardrobeItems', [
    { id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] },
    { id: 'i2', name: 'B', category: '下装', occasions: [], seasons: [] }
  ])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [{ category: '上衣', itemId: 'i1' }, { category: '下装', itemId: 'i2' }] }])
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: 'W', matchItemId: 'i1' }])
  store.set('privateWardrobeWearLogs', { '2026-07-01': ['i1', 'i2'] })
  const count = wardrobe.deleteItem('i1')
  assert.strictEqual(count, 1)
  assert.strictEqual(wardrobe.getItem('i1'), null)
  const outfit = wardrobe.getOutfit('o1')
  assert.deepStrictEqual(outfit.pieces.map((p) => p.itemId), ['i2'])
  assert.strictEqual(wardrobe.getWishlistItem('w1').matchItemId, '')
  assert.deepStrictEqual(wardrobe.getWearLog('2026-07-01'), ['i2'])
})
test('deleteItem: 不存在返回 0', () => {
  resetStorage()
  assert.strictEqual(wardrobe.deleteItem('ghost'), 0)
  assert.strictEqual(wardrobe.deleteItem(''), 0)
  assert.strictEqual(wardrobe.deleteItem(null), 0)
})

// ============ 6. 穿着记录 ============
test('setWearLog: 正常记录', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  const result = wardrobe.setWearLog('2026-07-01', ['i1'])
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.changed, true)
  assert.deepStrictEqual(wardrobe.getWearLog('2026-07-01'), ['i1'])
})
test('setWearLog: 同步更新穿着统计', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  wardrobe.setWearLog('2026-07-01', ['i1'])
  wardrobe.setWearLog('2026-07-02', ['i1'])
  assert.strictEqual(wardrobe.getItem('i1').wearCount, 2)
  assert.strictEqual(wardrobe.getItem('i1').lastWornDate, '2026-07-02')
})
test('setWearLog: 相同内容 changed=false 且不重复统计', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  wardrobe.setWearLog('2026-07-01', ['i1'])
  const result = wardrobe.setWearLog('2026-07-01', ['i1'])
  assert.strictEqual(result.changed, false)
  assert.strictEqual(wardrobe.getItem('i1').wearCount, 1)
})
test('setWearLog: 非法日期/未来日期拒绝', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  assert.strictEqual(wardrobe.setWearLog('', ['i1']).ok, false)
  assert.strictEqual(wardrobe.setWearLog('2026-13-01', ['i1']).ok, false)
  assert.strictEqual(wardrobe.setWearLog(null, ['i1']).ok, false)
  const future = wardrobe.formatLocalDate(new Date(Date.now() + 86400000 * 10))
  assert.strictEqual(wardrobe.setWearLog(future, ['i1']).ok, false)
})
test('setWearLog: 不存在的衣物拒绝', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  const result = wardrobe.setWearLog('2026-07-01', ['ghost'])
  assert.strictEqual(result.ok, false)
})
test('setWearLog: 重复 id 去重/非数组输入', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  wardrobe.setWearLog('2026-07-01', ['i1', 'i1'])
  assert.deepStrictEqual(wardrobe.getWearLog('2026-07-01'), ['i1'])
  wardrobe.setWearLog('2026-07-02', 'i1') // 字符串输入 -> 空
  assert.deepStrictEqual(wardrobe.getWearLog('2026-07-02'), [])
})
test('setWearLog: 清空当天记录时删除日期键（不残留空数组）', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  wardrobe.setWearLog('2026-07-01', ['i1'])
  assert.ok('2026-07-01' in wardrobe.getWearLogs())
  const result = wardrobe.setWearLog('2026-07-01', [])
  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(store.get('privateWardrobeWearLogs'), {})
})
test('deleteItems: 删除衣物后不残留空的穿着记录键', () => {
  resetStorage()
  const id = wardrobe.upsertItem({ name: 'A', category: '上衣' })
  wardrobe.markWorn(id, '2026-07-01')
  wardrobe.deleteItem(id)
  assert.deepStrictEqual(store.get('privateWardrobeWearLogs'), {})
})
test('markWorn: 正常记录今日', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  const result = wardrobe.markWorn('i1')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.alreadyRecorded, false)
})
test('markWorn: 重复记录拒绝', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  wardrobe.markWorn('i1', '2026-07-01')
  const result = wardrobe.markWorn('i1', '2026-07-01')
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.alreadyRecorded, true)
})
test('markWorn: 不存在的衣物/非法日期', () => {
  resetStorage()
  assert.strictEqual(wardrobe.markWorn('ghost').ok, false)
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  assert.strictEqual(wardrobe.markWorn('i1', 'not-a-date').ok, false)
})
test('getWearLogs: 损坏存储自愈为 {}', () => {
  resetStorage()
  store.set('privateWardrobeWearLogs', ['not-a-map'])
  assert.deepStrictEqual(wardrobe.getWearLogs(), {})
})
test('getWearLog: 无记录返回 []', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getWearLog('2026-07-01'), [])
  assert.deepStrictEqual(wardrobe.getWearLog(null), [])
})
test('hydrateWearLog: 返回真实衣物对象', () => {
  resetStorage()
  const items = [
    { id: 'i1', name: 'A', category: '上衣' },
    { id: 'i2', name: 'B', category: '下装' }
  ]
  store.set('privateWardrobeWearLogs', { '2026-07-01': ['i1', 'ghost', 'i2'] })
  const hydrated = wardrobe.hydrateWearLog('2026-07-01', items)
  assert.deepStrictEqual(hydrated.map((i) => i.id), ['i1', 'i2'])
})
test('getWearCalendar: 默认 21 天结构', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeWearLogs', { [wardrobe.formatLocalDate(new Date())]: ['i1'] })
  const calendar = wardrobe.getWearCalendar()
  assert.strictEqual(calendar.length, 21)
  assert.strictEqual(calendar[0].itemCount, 1)
  assert.strictEqual(calendar[0].names, 'A')
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(calendar[0].date))
})
test('getWearCalendar: 自定义天数/0 输入', () => {
  resetStorage()
  assert.strictEqual(wardrobe.getWearCalendar(7).length, 7)
  assert.strictEqual(wardrobe.getWearCalendar(0).length, 21) // 0 走默认
  assert.strictEqual(wardrobe.getWearCalendar(null).length, 21)
})
test('getCostPerWear: 正常计算', () => {
  assert.strictEqual(wardrobe.getCostPerWear({ price: 100, wearCount: 4 }), 25)
  assert.strictEqual(wardrobe.getCostPerWear({ price: 50, wearCount: 2 }), 25)
})
test('getCostPerWear: 零价格/零次数/缺字段返回 0', () => {
  assert.strictEqual(wardrobe.getCostPerWear({ price: 0, wearCount: 4 }), 0)
  assert.strictEqual(wardrobe.getCostPerWear({ price: 100, wearCount: 0 }), 0)
  assert.strictEqual(wardrobe.getCostPerWear({}), 0)
  assert.strictEqual(wardrobe.getCostPerWear({ price: 'abc', wearCount: 'xyz' }), 0)
})
test('BUG-CHECK getCostPerWear: null 输入应返回 0 而非崩溃', () => {
  resetStorage()
  const result = (() => {
    try {
      return { value: wardrobe.getCostPerWear(null) }
    } catch (error) {
      return { error }
    }
  })()
  assert.ok(!result.error, `期望返回 0 而非抛错: ${result.error && result.error.message}`)
  assert.strictEqual(result.value, 0)
})

// ============ 7. 穿搭 CRUD ============
test('getOutfits: 空存储返回 []', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getOutfits(), [])
})
test('upsertOutfit: 无 id 创建', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  const id = wardrobe.upsertOutfit({ name: '通勤装', pieces: [{ category: '上衣', itemId: 'i1' }] })
  assert.ok(id.startsWith('outfit_'))
  const outfit = wardrobe.getOutfit(id)
  assert.strictEqual(outfit.name, '通勤装')
  assert.strictEqual(outfit.pieces[0].itemId, 'i1')
})
test('upsertOutfit: 更新已有穿搭', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  wardrobe.upsertOutfit({ id: 'o1', name: '旧', pieces: [{ category: '上衣', itemId: 'i1' }] })
  wardrobe.upsertOutfit({ id: 'o1', name: '新', pieces: [{ category: '上衣', itemId: 'i1' }] })
  assert.strictEqual(wardrobe.getOutfit('o1').name, '新')
})
test('upsertOutfit: pieces 规范化（悬空引用剔除/分类自愈/去重）', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  const id = wardrobe.upsertOutfit({
    name: '脏数据',
    pieces: [
      { category: '旧分类', itemId: 'i1' },
      { category: '上衣', itemId: 'ghost' },
      { category: '上衣', itemId: 'i1' },
      { category: '', itemId: '' }
    ]
  })
  const outfit = wardrobe.getOutfit(id)
  assert.deepStrictEqual(outfit.pieces, [{ category: '上衣', itemId: 'i1' }])
})
test('upsertOutfit: null 输入抛出（调用方契约）', () => {
  resetStorage()
  const error = throws(() => wardrobe.upsertOutfit(null), 'upsertOutfit(null)')
  assert.ok(error instanceof TypeError)
})
test('getOutfit: 不存在返回 null', () => {
  resetStorage()
  assert.strictEqual(wardrobe.getOutfit('nope'), null)
  assert.strictEqual(wardrobe.getOutfit(null), null)
})
test('copyOutfit: 复制去掉 id/时间戳', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [{ category: '上衣', itemId: 'i1' }], createdAt: 'x', updatedAt: 'y' }])
  const copy = wardrobe.copyOutfit('o1')
  assert.strictEqual(copy.id, undefined)
  assert.strictEqual(copy.createdAt, undefined)
  assert.strictEqual(copy.updatedAt, undefined)
  assert.strictEqual(copy.name, 'O')
})
test('copyOutfit: 不存在返回 null', () => {
  resetStorage()
  assert.strictEqual(wardrobe.copyOutfit('nope'), null)
})
test('deleteOutfit: 删除穿搭', () => {
  resetStorage()
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [] }])
  wardrobe.deleteOutfit('o1')
  assert.strictEqual(wardrobe.getOutfit('o1'), null)
})
test('deleteOutfit: 删除不存在的穿搭不抛错', () => {
  resetStorage()
  wardrobe.deleteOutfit('nope')
  wardrobe.deleteOutfit(null)
})
test('hydrateOutfit: 填充 item/图片/名称', () => {
  resetStorage()
  const items = [
    { id: 'i1', name: '白衬衫', imageUrl: 'saved://a', category: '上衣' },
    { id: 'i2', name: '牛仔裤', imageUrl: '', category: '下装' }
  ]
  const outfit = wardrobe.hydrateOutfit({
    id: 'o1',
    name: 'O',
    pieces: [{ category: '上衣', itemId: 'i1' }, { category: '下装', itemId: 'ghost' }]
  }, items)
  assert.strictEqual(outfit.pieces[0].item.name, '白衬衫')
  assert.strictEqual(outfit.pieces[0].imageUrl, 'saved://a')
  assert.strictEqual(outfit.pieces[1].item, null)
  assert.strictEqual(outfit.pieces[1].name, '未选择')
  assert.strictEqual(outfit.pieces[1].imageUrl, '')
})
test('getOutfits: legacy 迁移 topId/bottomId -> pieces', () => {
  resetStorage()
  store.set('privateWardrobeItems', [
    { id: 't1', name: '上衣', category: '上衣', occasions: [], seasons: [] },
    { id: 'b1', name: '下装', category: '下装', occasions: [], seasons: [] }
  ])
  store.set('privateWardrobeOutfits', [{ id: 'legacy', name: '旧格式', topId: 't1', bottomId: 'b1' }])
  const outfits = wardrobe.getOutfits()
  assert.strictEqual(outfits[0].id, 'legacy')
  assert.deepStrictEqual(outfits[0].pieces, [
    { category: '上衣', itemId: 't1' },
    { category: '下装', itemId: 'b1' }
  ])
  assert.strictEqual('topId' in outfits[0], false)
})
test('getOutfits: 引用不存在衣物的 pieces 被剔除并回写', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 't1', name: '上衣', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [
    { id: 'o1', name: '正常', pieces: [{ category: '上衣', itemId: 't1' }, { category: '下装', itemId: 'ghost' }] }
  ])
  const outfits = wardrobe.getOutfits()
  assert.deepStrictEqual(outfits[0].pieces.map((p) => p.itemId), ['t1'])
  assert.strictEqual(store.get('privateWardrobeOutfits')[0].pieces.length, 1)
})

// ============ 8. 穿搭计划 ============
test('getOutfitPlans: 空/损坏存储自愈', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getOutfitPlans(), {})
  store.set('privateWardrobeOutfitPlans', 'garbage')
  assert.deepStrictEqual(wardrobe.getOutfitPlans(), {})
})
test('setOutfitPlan: 正常设置', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [{ category: '上衣', itemId: 'i1' }] }])
  const result = wardrobe.setOutfitPlan('2026-07-10', 'o1', '上班穿')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(wardrobe.getOutfitPlan('2026-07-10').outfitId, 'o1')
  assert.strictEqual(wardrobe.getOutfitPlan('2026-07-10').note, '上班穿')
})
test('setOutfitPlan: 更新保留 createdAt', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [{ category: '上衣', itemId: 'i1' }] }])
  wardrobe.setOutfitPlan('2026-07-10', 'o1', 'v1')
  const createdAt = wardrobe.getOutfitPlan('2026-07-10').createdAt
  wardrobe.setOutfitPlan('2026-07-10', 'o1', 'v2')
  assert.strictEqual(wardrobe.getOutfitPlan('2026-07-10').note, 'v2')
  assert.strictEqual(wardrobe.getOutfitPlan('2026-07-10').createdAt, createdAt)
})
test('setOutfitPlan: 非法日期/空穿搭/不存在穿搭', () => {
  resetStorage()
  assert.strictEqual(wardrobe.setOutfitPlan('', 'o1').ok, false)
  assert.strictEqual(wardrobe.setOutfitPlan('2026-13-01', 'o1').ok, false)
  assert.strictEqual(wardrobe.setOutfitPlan('2026-07-10', '').ok, false)
  assert.strictEqual(wardrobe.setOutfitPlan('2026-07-10', 'ghost').ok, false)
  assert.strictEqual(wardrobe.setOutfitPlan('2026-07-10', null).ok, false)
})
test('getOutfitPlan: 非法日期/无计划返回 null', () => {
  resetStorage()
  assert.strictEqual(wardrobe.getOutfitPlan('2026-07-10'), null)
  assert.strictEqual(wardrobe.getOutfitPlan('bad'), null)
  assert.strictEqual(wardrobe.getOutfitPlan(null), null)
})
test('deleteOutfitPlan: 正常删除/不存在 changed=false', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [{ category: '上衣', itemId: 'i1' }] }])
  wardrobe.setOutfitPlan('2026-07-10', 'o1')
  const result = wardrobe.deleteOutfitPlan('2026-07-10')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.changed, true)
  assert.strictEqual(wardrobe.deleteOutfitPlan('2026-07-10').changed, false)
})
test('deleteOutfitPlan: 非法日期', () => {
  resetStorage()
  assert.strictEqual(wardrobe.deleteOutfitPlan('bad').ok, false)
})
test('markOutfitPlanWorn: 正常标记穿着', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [{ category: '上衣', itemId: 'i1' }] }])
  wardrobe.setOutfitPlan('2026-07-10', 'o1')
  const result = wardrobe.markOutfitPlanWorn('2026-07-10')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.addedCount, 1)
  assert.deepStrictEqual(wardrobe.getWearLog('2026-07-10'), ['i1'])
})
test('markOutfitPlanWorn: 无计划/空穿搭', () => {
  resetStorage()
  assert.strictEqual(wardrobe.markOutfitPlanWorn('2026-07-10').ok, false)
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [] }])
  wardrobe.setOutfitPlan('2026-07-11', 'o1')
  assert.strictEqual(wardrobe.markOutfitPlanWorn('2026-07-11').ok, false)
})

// ============ 9. 愿望清单 CRUD ============
test('getWishlist: 空/损坏返回 []', () => {
  resetStorage()
  assert.deepStrictEqual(wardrobe.getWishlist(), [])
  store.set('privateWardrobeWishlist', 'garbage')
  assert.deepStrictEqual(wardrobe.getWishlist(), [])
})
test('getWishlist: 悬空 matchItemId 自动清除', () => {
  resetStorage()
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: 'W', matchItemId: 'ghost' }])
  assert.strictEqual(wardrobe.getWishlistItem('w1').matchItemId, '')
})
test('addWishlistItem: 添加后可通过 getWishlist 查到（实现契约：不返回 id）', () => {
  resetStorage()
  wardrobe.addWishlistItem({ name: '想买的外套', category: '外套' })
  const list = wardrobe.getWishlist()
  assert.strictEqual(list.length, 1)
  assert.strictEqual(list[0].name, '想买的外套')
  assert.ok(list[0].id.startsWith('wish_'))
})
test('BUG-CHECK addWishlistItem: null 输入应被拒绝而非静默创建空记录', () => {
  resetStorage()
  const before = wardrobe.getWishlist().length
  let thrown = false
  try {
    wardrobe.addWishlistItem(null)
  } catch (error) {
    thrown = true
  }
  const after = wardrobe.getWishlist().length
  assert.ok(thrown || after === before, `null 输入不应创建垃圾记录 (before=${before}, after=${after})`)
})
test('upsertWishlistItem: 新增/更新', () => {
  resetStorage()
  const id = wardrobe.upsertWishlistItem({ name: 'A', category: '上衣' })
  wardrobe.upsertWishlistItem({ id, name: 'B', category: '下装' })
  const item = wardrobe.getWishlistItem(id)
  assert.strictEqual(item.name, 'B')
  assert.strictEqual(item.category, '下装')
})
test('getWishlistItem: 不存在返回 null', () => {
  resetStorage()
  assert.strictEqual(wardrobe.getWishlistItem('nope'), null)
})
test('deleteWishlistItem: 删除并清理图片', () => {
  resetStorage()
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: 'W', imageUrl: 'saved://old' }])
  wardrobe.deleteWishlistItem('w1')
  assert.strictEqual(wardrobe.getWishlistItem('w1'), null)
  assert.ok(removedFiles.includes('saved://old'))
})
test('deleteWishlistItem: 删除不存在的项不抛错', () => {
  resetStorage()
  wardrobe.deleteWishlistItem('nope')
  wardrobe.deleteWishlistItem(null)
})
test('convertWishlistToItem: 转为衣物并移除愿望', () => {
  resetStorage()
  wardrobe.addWishlistItem({ name: '心仪的鞋', category: '鞋子', expectedPrice: '599' })
  const wish = wardrobe.getWishlist()[0]
  const result = wardrobe.convertWishlistToItem(wish.id)
  assert.strictEqual(result.ok, true)
  const item = wardrobe.getItem(result.itemId)
  assert.strictEqual(item.name, '心仪的鞋')
  assert.strictEqual(item.price, 599)
  assert.strictEqual(wardrobe.getWishlistItem(wish.id), null)
})
test('convertWishlistToItem: 不存在/空价格边界', () => {
  resetStorage()
  assert.strictEqual(wardrobe.convertWishlistToItem('nope').ok, false)
  wardrobe.addWishlistItem({ name: '免费愿望', expectedPrice: '' })
  const wish = wardrobe.getWishlist()[0]
  const result = wardrobe.convertWishlistToItem(wish.id)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(wardrobe.getItem(result.itemId).price, '')
})
test('purchaseWishlistItem: 已购并标记状态', () => {
  resetStorage()
  wardrobe.addWishlistItem({ name: '已购物品', category: '配饰', expectedPrice: 100 })
  const wish = wardrobe.getWishlist()[0]
  const result = wardrobe.purchaseWishlistItem(wish.id)
  assert.strictEqual(result.ok, true)
  const item = wardrobe.getItem(result.itemId)
  assert.strictEqual(item.status, '偶尔穿')
  assert.strictEqual(wardrobe.getWishlistItem(wish.id), null)
})
test('purchaseWishlistItem: 不存在', () => {
  resetStorage()
  assert.strictEqual(wardrobe.purchaseWishlistItem('nope').ok, false)
})

// ============ 10. 批量操作 ============
test('batchUpdateCategory: 批量更新分类', () => {
  resetStorage()
  store.set('privateWardrobeItems', [
    { id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] },
    { id: 'i2', name: 'B', category: '下装', occasions: [], seasons: [] },
    { id: 'i3', name: 'C', category: '外套', occasions: [], seasons: [] }
  ])
  const result = wardrobe.batchUpdateCategory(['i1', 'i2'], '外套')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(wardrobe.getItem('i1').category, '外套')
  assert.strictEqual(wardrobe.getItem('i2').category, '外套')
  assert.strictEqual(wardrobe.getItem('i3').category, '外套')
})
test('batchUpdateCategory: 空 ids/空分类拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.batchUpdateCategory([], '外套').ok, false)
  assert.strictEqual(wardrobe.batchUpdateCategory(['i1'], '').ok, false)
  assert.strictEqual(wardrobe.batchUpdateCategory(null, '外套').ok, false)
})
test('batchAddOccasions: 批量追加场合去重', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: ['通勤'], seasons: [] }])
  const result = wardrobe.batchAddOccasions(['i1'], ['通勤', '旅行'])
  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(wardrobe.getItem('i1').occasions, ['通勤', '旅行'])
})
test('batchAddOccasions: 空输入拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.batchAddOccasions([], ['旅行']).ok, false)
  assert.strictEqual(wardrobe.batchAddOccasions(['i1'], []).ok, false)
})
test('batchDeleteItems: 批量删除', () => {
  resetStorage()
  store.set('privateWardrobeItems', [
    { id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] },
    { id: 'i2', name: 'B', category: '下装', occasions: [], seasons: [] }
  ])
  const result = wardrobe.batchDeleteItems(['i1', 'i2'])
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.count, 2)
  assert.deepStrictEqual(wardrobe.getItems(), [])
})
test('batchDeleteItems: 空 ids', () => {
  resetStorage()
  assert.strictEqual(wardrobe.batchDeleteItems([]).ok, false)
})

// ============ 11. 备份导入导出 ============
test('exportData: v3 格式含全部集合', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', imageUrl: 'saved://a', wearCount: 3, occasions: [], seasons: [] }])
  const backup = wardrobe.exportData()
  assert.strictEqual(backup.version, 3)
  assert.ok(backup.exportedAt)
  assert.strictEqual(backup.items[0].imageUrl, '')
  assert.strictEqual(backup.items[0].wearCount, 3)
  assert.ok(Array.isArray(backup.outfits))
  assert.ok(Array.isArray(backup.wishlist))
  assert.ok(typeof backup.wearLogs === 'object')
  assert.ok(Array.isArray(backup.categories))
  assert.ok(Array.isArray(backup.occasions))
  assert.strictEqual(backup.images, undefined)
})
test('validateBackup: 合法 v3 备份', () => {
  resetStorage()
  const result = wardrobe.validateBackup({ version: 3, items: [], outfits: [], wishlist: [] })
  assert.strictEqual(result.ok, true)
})
test('validateBackup: 非 JSON 字符串/缺字段拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.validateBackup('not json').ok, false)
  assert.strictEqual(wardrobe.validateBackup(null).ok, false)
  assert.strictEqual(wardrobe.validateBackup({}).ok, false)
  assert.strictEqual(wardrobe.validateBackup({ items: [], outfits: [] }).ok, false)
  assert.strictEqual(wardrobe.validateBackup({ items: 'x', outfits: [], wishlist: [] }).ok, false)
})
test('validateBackup: 无效记录拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.validateBackup({ items: [{}], outfits: [], wishlist: [] }).ok, false)
  assert.strictEqual(wardrobe.validateBackup({ items: [null], outfits: [], wishlist: [] }).ok, false)
  assert.strictEqual(wardrobe.validateBackup({ items: [], outfits: [{ id: '' }], wishlist: [] }).ok, false)
})
test('validateBackup: 非法日期/格式拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.validateBackup({
    items: [], outfits: [], wishlist: [], wearLogs: { 'bad-date': ['i1'] }
  }).ok, false)
  assert.strictEqual(wardrobe.validateBackup({
    items: [], outfits: [], wishlist: [], wearLogs: { '2026-07-01': 'not-array' }
  }).ok, false)
  assert.strictEqual(wardrobe.validateBackup({
    items: [], outfits: [], wishlist: [], outfitPlans: { '2026-07-10': {} }
  }).ok, false)
  assert.strictEqual(wardrobe.validateBackup({
    items: [], outfits: [], wishlist: [], wearLogs: []
  }).ok, false)
})
test('validateBackup: 图片引用缺失拒绝', () => {
  resetStorage()
  assert.strictEqual(wardrobe.validateBackup({
    version: 4,
    items: [{ id: 'x1', imageRef: 'r1' }],
    outfits: [],
    wishlist: [],
    images: {}
  }).ok, false)
  assert.strictEqual(wardrobe.validateBackup({
    version: 4,
    items: [{ id: 'x1', imageRef: 'r1' }],
    outfits: [],
    wishlist: [],
    images: { r1: { data: '' } }
  }).ok, false)
})
test('validateBackup: 畸形字段类型归一化（name 对象→空串、price 非法→空串）', () => {
  resetStorage()
  const result = wardrobe.validateBackup({
    version: 4,
    items: [{ id: 'x1', name: { hack: 1 }, price: '免费', note: ['a'], occasions: ['通勤', 5, null], seasons: '夏', category: 7 }],
    outfits: [{ id: 'o1', name: { x: 1 }, pieces: [{ itemId: 5, category: null }, { itemId: '' }, 'junk'] }],
    wishlist: [{ id: 'w1', name: 123, expectedPrice: 'abc', matchItemId: { bad: 1 } }],
    images: {}
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.backup.items[0].name, '')
  assert.strictEqual(result.backup.items[0].price, '')
  assert.strictEqual(result.backup.items[0].note, '')
  assert.strictEqual(result.backup.items[0].category, '7')
  assert.deepStrictEqual(result.backup.items[0].occasions, ['通勤', '5'])
  assert.deepStrictEqual(result.backup.items[0].seasons, [])
  assert.strictEqual(result.backup.outfits[0].name, '')
  assert.deepStrictEqual(result.backup.outfits[0].pieces, [{ itemId: '5', category: '' }])
  assert.strictEqual(result.backup.wishlist[0].name, '123')
  assert.strictEqual(result.backup.wishlist[0].expectedPrice, '')
  assert.strictEqual(result.backup.wishlist[0].matchItemId, '')
})
test('validateBackup: 合法数值价格保留、0 不被清空', () => {
  resetStorage()
  const result = wardrobe.validateBackup({
    version: 3,
    items: [{ id: 'p1', name: 'A', price: 159.5 }, { id: 'p2', name: 'B', price: 0 }, { id: 'p3', name: 'C', price: '' }],
    outfits: [],
    wishlist: []
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.backup.items[0].price, 159.5)
  assert.strictEqual(result.backup.items[1].price, 0)
  assert.strictEqual(result.backup.items[2].price, '')
})
test('importData: 畸形备份入库后字段为安全类型，页面可正常编辑', () => {
  resetStorage()
  const result = wardrobe.importData({
    version: 3,
    items: [{ id: 'x1', name: { hack: 1 }, price: '免费', updatedAt: '2026-01-01T00:00:00Z' }],
    outfits: [],
    wishlist: [{ id: 'w1', name: ['arr'], expectedPrice: { v: 1 }, updatedAt: '2026-01-01T00:00:00Z' }]
  })
  assert.strictEqual(result.ok, true)
  const item = wardrobe.getItem('x1')
  assert.strictEqual(item.name, '') // add.js saveItem 的 form.name.trim() 不再抛 TypeError
  assert.strictEqual(item.price, '')
  const wish = wardrobe.getWishlistItem('w1')
  assert.strictEqual(wish.name, '')
  assert.strictEqual(wish.expectedPrice, '')
})
test('importData: JSON 字符串导入合并', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'local', name: '本地', category: '上衣', occasions: [], seasons: [] }])
  const backup = {
    version: 3,
    items: [{ id: 'i1', name: '备份衣物', category: '下装', occasions: [], seasons: [], wearCount: 1 }],
    outfits: [],
    wishlist: [],
    wearLogs: {},
    outfitPlans: {},
    categories: ['上衣'],
    occasions: ['通勤']
  }
  const result = wardrobe.importData(JSON.stringify(backup))
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.merged, true)
  assert.strictEqual(wardrobe.getItem('i1').name, '备份衣物')
  assert.strictEqual(wardrobe.getItem('local').name, '本地')
})
test('importData: 无效备份返回 ok:false', () => {
  resetStorage()
  assert.strictEqual(wardrobe.importData('garbage').ok, false)
  assert.strictEqual(wardrobe.importData(null).ok, false)
})
test('importData: v4 含图备份被拒绝（提示用图片恢复）', () => {
  resetStorage()
  const result = wardrobe.importData({
    version: 4,
    items: [{ id: 'x1', imageRef: 'r1' }],
    outfits: [],
    wishlist: [],
    images: { r1: { data: 'QUFB', extension: 'jpg' } }
  })
  assert.strictEqual(result.ok, false)
  assert.ok(result.message.includes('图片'))
})
test('clearAllData: 清空全部并重置分类', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', imageUrl: 'saved://old', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'O', pieces: [] }])
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: 'W' }])
  store.set('privateWardrobeWearLogs', { '2026-07-01': ['i1'] })
  store.set('privateWardrobeOutfitPlans', { '2026-07-10': { outfitId: 'o1' } })
  const result = wardrobe.clearAllData()
  assert.strictEqual(result.ok, true)
  assert.deepStrictEqual(wardrobe.getItems(), [])
  assert.deepStrictEqual(wardrobe.getOutfits(), [])
  assert.deepStrictEqual(wardrobe.getWishlist(), [])
  assert.deepStrictEqual(wardrobe.getWearLogs(), {})
  assert.deepStrictEqual(wardrobe.getOutfitPlans(), {})
  assert.deepStrictEqual(wardrobe.getCustomCategories(), wardrobe.defaultCategories)
  assert.deepStrictEqual(wardrobe.getCustomOccasions(), wardrobe.defaultOccasions)
})
test('clearAllData: 一并删除导出的备份文件与恢复图片目录', () => {
  resetStorage()
  fileContents.set('wxfile://usr/wardrobe-backup-2026-08-22.json', '{"version":4}')
  fileContents.set('wxfile://usr/wardrobe-backup-2026-08-01.json', '{"version":4}')
  fileContents.set('wxfile://usr/wardrobe-images/restore-1.jpg', 'x')
  fileContents.set('wxfile://usr/wardrobe-images/restore-2.jpg', 'y')
  fileContents.set('wxfile://usr/keep-me.txt', 'other')
  wardrobe.clearAllData()
  assert.ok(!fileContents.has('wxfile://usr/wardrobe-backup-2026-08-22.json'))
  assert.ok(!fileContents.has('wxfile://usr/wardrobe-backup-2026-08-01.json'))
  assert.ok(!fileContents.has('wxfile://usr/wardrobe-images/restore-1.jpg'))
  assert.ok(!fileContents.has('wxfile://usr/wardrobe-images/restore-2.jpg'))
  assert.ok(fileContents.has('wxfile://usr/keep-me.txt'))
})

// ============ 12. 图片管理 ============
test('removeImageFile: userDataPath 内文件走 unlink', () => {
  resetStorage()
  wardrobe.removeImageFile('wxfile://usr/wardrobe-images/a.jpg')
  assert.ok(unlinkedFiles.includes('wxfile://usr/wardrobe-images/a.jpg'))
})
test('removeImageFile: 外部文件走 removeSavedFile 且仅当存在', () => {
  resetStorage()
  wardrobe.removeImageFile('saved://old')
  assert.ok(removedFiles.includes('saved://old'))
})
test('removeImageFile: 空输入 no-op', () => {
  resetStorage()
  wardrobe.removeImageFile('')
  wardrobe.removeImageFile(null)
  assert.strictEqual(removedFiles.length, 0)
})
test('removeImageFileIfUnused: 使用中不删除', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', imageUrl: 'saved://old', occasions: [], seasons: [] }])
  assert.strictEqual(wardrobe.removeImageFileIfUnused('saved://old'), false)
  assert.strictEqual(removedFiles.length, 0)
})
test('removeImageFileIfUnused: 未使用则删除', () => {
  resetStorage()
  assert.strictEqual(wardrobe.removeImageFileIfUnused('saved://old'), true)
  assert.ok(removedFiles.includes('saved://old'))
})
test('clearItemImage: 清除衣物图片', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', imageUrl: 'saved://old', occasions: [], seasons: [] }])
  assert.strictEqual(wardrobe.clearItemImage('i1'), true)
  assert.strictEqual(wardrobe.getItem('i1').imageUrl, '')
})
test('clearItemImage: 不存在/无图/url 不匹配返回 false', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', occasions: [], seasons: [] }])
  assert.strictEqual(wardrobe.clearItemImage('ghost'), false)
  assert.strictEqual(wardrobe.clearItemImage('i1'), false)
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'A', category: '上衣', imageUrl: 'saved://a', occasions: [], seasons: [] }])
  assert.strictEqual(wardrobe.clearItemImage('i1', 'saved://other'), false)
})
test('clearWishlistImage: 清除愿望图片', () => {
  resetStorage()
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: 'W', imageUrl: 'saved://old' }])
  assert.strictEqual(wardrobe.clearWishlistImage('w1'), true)
  assert.strictEqual(wardrobe.getWishlistItem('w1').imageUrl, '')
  assert.strictEqual(wardrobe.clearWishlistImage('w1'), false)
})

// ============ 13. 统计与展示 ============
test('getIdleStatus: 未穿过 isIdle', () => {
  resetStorage()
  const status = wardrobe.getIdleStatus({ id: 'i1', name: 'A', category: '上衣', wearCount: 0, occasions: [], seasons: [] })
  assert.strictEqual(status.isIdle, true)
  assert.strictEqual(status.text, '暂未记录穿着')
})
test('getIdleStatus: 超过阈值天数', () => {
  resetStorage()
  const oldDate = wardrobe.formatLocalDate(new Date(Date.now() - 90 * 86400000))
  const status = wardrobe.getIdleStatus({ id: 'i1', name: 'A', category: '上衣', wearCount: 3, lastWornDate: oldDate, occasions: [], seasons: [] })
  assert.strictEqual(status.isIdle, true)
  assert.ok(status.text.startsWith('已 9'))
  assert.ok(status.text.includes('天未穿'))
})
test('getIdleStatus: 正常状态', () => {
  resetStorage()
  const today = wardrobe.formatLocalDate(new Date())
  const status = wardrobe.getIdleStatus({ id: 'i1', name: 'A', category: '上衣', wearCount: 3, lastWornDate: today, occasions: [], seasons: [] })
  assert.strictEqual(status.isIdle, false)
  assert.strictEqual(status.text, '0 天前')
})
test('getIdleStatus: 空对象输入不崩溃', () => {
  resetStorage()
  const status = wardrobe.getIdleStatus({})
  assert.strictEqual(status.isIdle, true)
  assert.strictEqual(status.text, '暂未记录穿着')
})
test('BUG-CHECK getIdleStatus: null 输入应不崩溃（当前 normalizeItem 直接抛错）', () => {
  resetStorage()
  const result = (() => {
    try {
      return { value: wardrobe.getIdleStatus(null) }
    } catch (error) {
      return { error }
    }
  })()
  assert.ok(!result.error, `期望不崩溃: ${result.error && result.error.message}`)
})
test('enrichItemForDisplay: 附加 idle 信息', () => {
  resetStorage()
  const enriched = wardrobe.enrichItemForDisplay({ id: 'i1', name: 'A', category: '上衣', wearCount: 0, occasions: [], seasons: [] })
  assert.strictEqual(enriched.idleText, '暂未记录穿着')
  assert.strictEqual(enriched.idleStatus.isIdle, true)
})
test('getHomeInsights: 结构完整', () => {
  resetStorage()
  store.set('privateWardrobeItems', [
    { id: 'i1', name: 'A', category: '上衣', wearCount: 2, seasons: [wardrobe.getCurrentSeason()], lastWornDate: wardrobe.formatLocalDate(new Date()), occasions: [], status: '' },
    { id: 'i2', name: 'B', category: '下装', wearCount: 0, seasons: [], occasions: [], status: '' }
  ])
  const insights = wardrobe.getHomeInsights(wardrobe.getItems())
  assert.ok(insights.currentSeason)
  assert.ok(Array.isArray(insights.recentItems))
  assert.ok(Array.isArray(insights.staleItems))
  assert.ok(Array.isArray(insights.weeklyItems))
  assert.strictEqual(typeof insights.todayRecordCount, 'number')
  assert.ok(insights.recentItems.length <= 4)
})
test('getHomeInsights: 空输入', () => {
  resetStorage()
  const insights = wardrobe.getHomeInsights([])
  assert.deepStrictEqual(insights.recentItems, [])
  assert.deepStrictEqual(insights.staleItems, [])
  assert.deepStrictEqual(insights.weeklyItems, [])
})
test('summarize: 核心统计字段', () => {
  resetStorage()
  const summary = wardrobe.summarize([
    { id: 'a1', name: 'A', category: '上衣', price: 100, wearCount: 2, occasions: ['通勤'], seasons: ['夏'] },
    { id: 'a2', name: 'B', category: '上衣', price: 300, wearCount: 0, occasions: ['通勤'], seasons: ['夏'] },
    { id: 'a3', name: 'C', category: '下装', price: 50, wearCount: 4, occasions: ['约会'], seasons: ['冬'] }
  ])
  assert.strictEqual(summary.totalCount, 3)
  assert.strictEqual(summary.totalPrice, 450)
  assert.strictEqual(summary.averagePrice, 150)
  assert.strictEqual(summary.totalWearCount, 6)
  assert.strictEqual(summary.wornItemCount, 2)
  assert.strictEqual(summary.neverWornCount, 1)
  assert.strictEqual(summary.mostWornItem.name, 'C')
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
  assert.deepStrictEqual(summary.priceRange, { min: 50, max: 300 })
  assert.strictEqual(summary.mostWornItems[0].id, 'a3')
  assert.strictEqual(summary.highestCostPerWearItems[0].id, 'a1')
})
test('summarize: 空数组', () => {
  resetStorage()
  const summary = wardrobe.summarize([])
  assert.strictEqual(summary.totalCount, 0)
  assert.strictEqual(summary.totalPrice, 0)
  assert.strictEqual(summary.averagePrice, 0)
  assert.strictEqual(summary.mostWornItem.name, '')
  assert.deepStrictEqual(summary.priceRange, { min: 0, max: 0 })
})
test('summarize: null/非数组输入抛出（调用方契约）', () => {
  resetStorage()
  const error = throws(() => wardrobe.summarize(null), 'summarize(null)')
  assert.ok(error instanceof TypeError)
})

// ============ 14. 已知缺陷回归（期望行为 vs 实际行为） ============
test('BUG-CHECK getOutfits: 纯 legacy 迁移结果应写回存储（migration-1 期望）', () => {
  resetStorage()
  store.set('privateWardrobeItems', [
    { id: 't1', name: '上衣', category: '上衣', occasions: [], seasons: [] },
    { id: 'b1', name: '下装', category: '下装', occasions: [], seasons: [] }
  ])
  store.set('privateWardrobeOutfits', [{ id: 'legacy', name: '旧格式', topId: 't1', bottomId: 'b1' }])
  wardrobe.getOutfits()
  const persisted = store.get('privateWardrobeOutfits')
  assert.strictEqual(persisted[0].id, 'legacy', '迁移后应保留在存储中')
  assert.ok(Array.isArray(persisted[0].pieces), '迁移结果应写回 pieces 格式')
})
test('BUG-CHECK getOutfits: 存储含 null/非对象元素应剔除而非崩溃（migration-7 期望）', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'ok', name: '正常', category: '上衣', occasions: [], seasons: [] }])
  store.set('privateWardrobeOutfits', [
    { id: 'good', name: '合法', pieces: [{ category: '上衣', itemId: 'ok' }] },
    null,
    'string-garbage',
    42
  ])
  const outfits = wardrobe.getOutfits()
  assert.deepStrictEqual(outfits.map((o) => o.id), ['good'], '非对象元素应被剔除')
})

// ============ 执行汇总 ============
async function run() {
  // 同步用例已在上方注册，这里只需触发异步用例
  await testAsync('exportDataWithImages: v4 图片去重导出', async () => {
    resetStorage()
    fileContents.set('saved://a.jpg', 'QUFBQUJBPT0=')
    store.set('privateWardrobeItems', [
      { id: 'p1', name: '图1', category: '上衣', imageUrl: 'saved://a.jpg', updatedAt: '2026-07-01T00:00:00.000Z', occasions: [], seasons: [] },
      { id: 'p2', name: '图2', category: '下装', imageUrl: 'saved://a.jpg', updatedAt: '2026-07-01T00:00:00.000Z', occasions: [], seasons: [] }
    ])
    const backup = await wardrobe.exportDataWithImages()
    assert.strictEqual(backup.version, 4)
    assert.strictEqual(Object.keys(backup.images).length, 1)
    assert.strictEqual(backup.items[0].imageRef, backup.items[1].imageRef)
    assert.strictEqual(backup.items[0].imageUrl, '')
    assert.strictEqual(backup.images[backup.items[0].imageRef].data, 'QUFBQUJBPT0=')
  })
  await testAsync('exportDataWithImages: 无图导出', async () => {
    resetStorage()
    store.set('privateWardrobeItems', [{ id: 'p1', name: '无图', category: '上衣', occasions: [], seasons: [] }])
    const backup = await wardrobe.exportDataWithImages()
    assert.strictEqual(backup.version, 4)
    assert.deepStrictEqual(backup.images, {})
  })
  await testAsync('importDataWithImages: v4 图片恢复并清理 imageRef', async () => {
    resetStorage()
    fileContents.set('saved://a.jpg', 'QUFBQUJBPT0=')
    store.set('privateWardrobeItems', [{ id: 'p1', name: '图1', category: '上衣', imageUrl: 'saved://a.jpg', updatedAt: '2026-07-01T00:00:00.000Z', occasions: [], seasons: [] }])
    const backup = await wardrobe.exportDataWithImages()
    resetStorage()
    store.set('privateWardrobeItems', [])
    const result = await wardrobe.importDataWithImages(backup)
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.imageCount, 1)
    const item = wardrobe.getItem('p1')
    assert.ok(item.imageUrl.startsWith('wxfile://usr/wardrobe-images/restore-'))
    assert.strictEqual(item.imageRef, undefined)
  })
  await testAsync('importDataWithImages: 无图 v3 备份走普通合并', async () => {
    resetStorage()
    const result = await wardrobe.importDataWithImages({ version: 3, items: [], outfits: [], wishlist: [] })
    assert.strictEqual(result.ok, true)
  })
  await testAsync('persistImage: 保存返回持久化路径', async () => {
    resetStorage()
    const path = await wardrobe.persistImage('temp://photo.jpg')
    assert.strictEqual(path, 'saved://temp://photo.jpg')
  })
  await testAsync('importDataWithImages: 存储配额中途耗尽时回滚，不留半合并状态', async () => {
    resetStorage()
    wardrobe.upsertItem({ name: '本地衣物', category: '上衣' })
    const before = {
      items: store.get('privateWardrobeItems'),
      wearLogs: store.get('privateWardrobeWearLogs'),
      categories: store.get('privateWardrobeCustomCategories')
    }
    const originalSet = global.wx.setStorageSync
    global.wx.setStorageSync = function patchedSet(key, value) {
      if (key === 'privateWardrobeWearLogs') {
        throw new Error('setStorageSync:fail exceed storage max size')
      }
      return originalSet.call(this, key, value)
    }
    const result = await wardrobe.importDataWithImages({
      version: 4,
      items: [{ id: 'y1', name: '备份衣物', category: '下装', updatedAt: '2026-02-02T00:00:00Z' }],
      outfits: [],
      wishlist: [],
      images: {}
    })
    global.wx.setStorageSync = originalSet
    assert.strictEqual(result.ok, false)
    assert.ok(result.message)
    assert.deepStrictEqual(store.get('privateWardrobeItems'), before.items)
    assert.ok(!store.get('privateWardrobeItems').some((item) => item.id === 'y1'))
    assert.deepStrictEqual(store.get('privateWardrobeWearLogs') || {}, before.wearLogs || {})
    assert.deepStrictEqual(store.get('privateWardrobeCustomCategories'), before.categories)
  })

  console.log('')
  console.log('========== 回归测试结果 ==========')
  console.log(`用例总数: ${passed + failed}`)
  console.log(`通过: ${passed}`)
  console.log(`失败: ${failed}`)
  if (SKIP.length) console.log(`跳过: ${SKIP.length} (${SKIP.join(', ')})`)
  if (failures.length) {
    console.log('')
    console.log('--- 失败明细 ---')
    failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.name}`)
      console.log(`   ${failure.message}`)
    })
  }
  process.exitCode = failed ? 1 : 0
}

run().catch((error) => {
  console.error('RUNNER ERROR', error)
  process.exitCode = 1
})
