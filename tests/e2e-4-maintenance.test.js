// 场景4: 衣柜维护 —— 批量分类修改 → 批量添加场合 → 清理闲置衣物 → 闲置提醒
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

function ok(condition, message) {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return wardrobe.formatLocalDate(d)
}

resetStorage()

// ---- 4.1 造数：4 件衣物（2 件闲置候选 + 1 件近期穿过 + 1 件从未穿过） ----
const i1 = wardrobe.upsertItem({
  name: '白色衬衫', category: '上衣', price: 159, imageUrl: '', color: '白',
  seasons: ['春'], occasions: ['通勤'], purchaseDate: dateOffset(-60), status: '常穿', note: ''
})
wardrobe.markWorn(i1, dateOffset(-1)) // 昨天穿过 → 非闲置
const i2 = wardrobe.upsertItem({
  name: '黑色半身裙', category: '下装', price: 249, imageUrl: '', color: '黑',
  seasons: ['春', '夏'], occasions: ['通勤'], purchaseDate: dateOffset(-90), status: '偶尔穿', note: ''
}) // 从未穿过 → 闲置
const i3 = wardrobe.upsertItem({
  name: '羽绒服', category: '外套', price: 899, imageUrl: '', color: '藏青',
  seasons: ['冬'], occasions: ['通勤'], purchaseDate: dateOffset(-200), status: '闲置', note: ''
})
wardrobe.markWorn(i3, dateOffset(-100)) // 100 天前穿过 → 超过 60 天阈值 → 闲置
const i4 = wardrobe.upsertItem({
  name: '高跟鞋', category: '鞋子', price: 399, imageUrl: '', color: '米色',
  seasons: ['夏'], occasions: ['正式'], purchaseDate: dateOffset(-30), status: '闲置', note: ''
}) // 从未穿过 → 闲置
// 模拟历史穿着日志含 i4（原始存储写入，验证删除级联清理日志）
const logs = wardrobe.getWearLogs()
logs[dateOffset(-3)] = [i4]
store.set('privateWardrobeWearLogs', logs)
ok(wardrobe.getItems().length === 4, '应造出 4 件衣物')
console.log('e2e-4.1 造数: OK')

// ---- 4.2 批量分类修改 ----
let result = wardrobe.batchUpdateCategory([i1, i2, 'ghost-id'], '下装')
ok(result.ok === true, '批量改分类应成功')
ok(wardrobe.getItem(i1).category === '下装', `i1 分类应改为 下装, 实际 ${wardrobe.getItem(i1).category}`)
ok(wardrobe.getItem(i2).category === '下装', 'i2 分类应改为 下装')
ok(wardrobe.getItem(i3).category === '外套', 'i3 分类不应受影响')
ok(wardrobe.getItem(i4).category === '鞋子', 'i4 分类不应受影响')
// 边界：空 ID 列表 / 空分类
ok(wardrobe.batchUpdateCategory([], '外套').ok === false, '空 ID 列表应失败')
ok(wardrobe.batchUpdateCategory([i1], '').ok === false, '空分类应失败')
console.log('e2e-4.2 批量分类修改: OK')

// ---- 4.3 批量添加场合（追加去重，保留已有场合） ----
result = wardrobe.batchAddOccasions([i1, i2, i3], ['旅行'])
ok(result.ok === true, '批量添加场合应成功')
result = wardrobe.batchAddOccasions([i1, i2, i3], ['旅行', '运动'])
ok(result.ok === true, '重复添加应成功')
const o1 = wardrobe.getItem(i1)
ok(o1.occasions.includes('通勤') && o1.occasions.includes('旅行') && o1.occasions.includes('运动'), 'i1 场合应追加且保留原有')
ok(o1.occasions.filter((x) => x === '旅行').length === 1, '场合应去重')
ok(wardrobe.getItem(i4).occasions.length === 1 && wardrobe.getItem(i4).occasions[0] === '正式', 'i4 不应受影响')
// 边界：空参数
ok(wardrobe.batchAddOccasions([], ['旅行']).ok === false, '空 ID 列表应失败')
ok(wardrobe.batchAddOccasions([i1], []).ok === false, '空场合应失败')
console.log('e2e-4.3 批量添加场合: OK')

// ---- 4.4 闲置提醒（getIdleStatus / getHomeInsights.staleItems） ----
const idle2 = wardrobe.getIdleStatus(wardrobe.getItem(i2))
ok(idle2.isIdle === true && idle2.text === '暂未记录穿着', `i2 应判闲置(从未穿过): ${JSON.stringify(idle2)}`)
const idle3 = wardrobe.getIdleStatus(wardrobe.getItem(i3))
ok(idle3.isIdle === true && /^已 \d+ 天未穿$/.test(idle3.text), `i3 应判闲置(超过阈值): ${JSON.stringify(idle3)}`)
const idle1 = wardrobe.getIdleStatus(wardrobe.getItem(i1))
ok(idle1.isIdle === false, `i1 昨天穿过不应闲置: ${JSON.stringify(idle1)}`)
const enriched = wardrobe.enrichItemForDisplay(wardrobe.getItem(i2))
ok(enriched.idleStatus.isIdle === true && enriched.idleText === '暂未记录穿着', 'enrichItemForDisplay 应带闲置标记')
const insights = wardrobe.getHomeInsights()
const staleIds = insights.staleItems.map((item) => item.id)
ok(staleIds.includes(i2) && staleIds.includes(i3) && staleIds.includes(i4), '首页闲置提醒应包含 3 件闲置衣物')
ok(!staleIds.includes(i1), '首页闲置提醒不应包含 i1')
// 阈值边界：自定义阈值 30 天时 i3 闲置，100 天时 i1(昨天) 仍不闲置
ok(wardrobe.getIdleStatus(wardrobe.getItem(i3), 30).isIdle === true, '自定义阈值 30 天 i3 仍闲置')
console.log('e2e-4.4 闲置提醒: OK')

// ---- 4.5 清理闲置衣物（批量删除 + 级联清理穿着日志） ----
result = wardrobe.batchDeleteItems([i2, i4])
ok(result.ok === true && result.count === 2, `应删除 2 件, 实际 ${JSON.stringify(result)}`)
ok(wardrobe.getItems().length === 2, '剩余应为 2 件')
ok(wardrobe.getItem(i1) && wardrobe.getItem(i3), 'i1/i3 应保留')
ok(!wardrobe.getItem(i2) && !wardrobe.getItem(i4), 'i2/i4 应删除')
ok(wardrobe.getWearLog(dateOffset(-3)).length === 0, '删除后穿着日志中的 i4 应被清理')
// 删除后剩余闲置提醒只剩 i3
const staleAfter = wardrobe.getHomeInsights().staleItems.map((item) => item.id)
ok(staleAfter.includes(i3) && !staleAfter.includes(i2), '清理后闲置提醒只剩 i3')
// 边界：空 ID 列表
ok(wardrobe.batchDeleteItems([]).ok === false, '空 ID 列表删除应失败')
console.log('e2e-4.5 清理闲置衣物: OK')

console.log('e2e-4 maintenance: ALL PASS')