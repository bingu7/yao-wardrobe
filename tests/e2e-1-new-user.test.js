// 场景1: 新用户首次使用 —— 空衣柜 → 添加3件衣物 → 创建2套穿搭 → 制定7天穿搭计划 → 逐日标记穿着 → 查看周统计
const assert = require('assert')
const { store, wardrobe, resetStorage } = require('./_mock')

// 本地日期工具：相对今天偏移 N 天，格式 YYYY-MM-DD
function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return wardrobe.formatLocalDate(d)
}

function ok(condition, message) {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

resetStorage()

// ---- 1.1 空衣柜 ----
ok(Array.isArray(wardrobe.getItems()) && wardrobe.getItems().length === 0, '新用户衣柜应为空')
console.log('e2e-1.1 空衣柜: OK')

// ---- 1.2 添加 3 件衣物（不同分类） ----
const item1 = wardrobe.upsertItem({
  name: '白色衬衫', category: '上衣', price: 159, imageUrl: '', color: '白色',
  seasons: ['春', '秋'], occasions: ['通勤'], purchaseDate: dateOffset(-30), status: '常穿', note: ''
})
const item2 = wardrobe.upsertItem({
  name: '深蓝牛仔裤', category: '下装', price: 299, imageUrl: '', color: '深蓝',
  seasons: ['春', '夏', '秋'], occasions: ['通勤', '休闲'], purchaseDate: dateOffset(-30), status: '常穿', note: ''
})
const item3 = wardrobe.upsertItem({
  name: '卡其风衣', category: '外套', price: 599, imageUrl: '', color: '卡其',
  seasons: ['春', '秋'], occasions: ['通勤', '约会'], purchaseDate: dateOffset(-20), status: '偶尔穿', note: ''
})
const items = wardrobe.getItems()
ok(items.length === 3, '应恰好有 3 件衣物')
ok(items.every((i) => i.id && i.name && i.category), '每件衣物应有 id/name/category')
ok(new Set(items.map((i) => i.category)).size === 3, '3 件衣物分类应各不相同')
ok(items.every((i) => i.wearCount === 0 && i.lastWornDate === ''), '新衣物 wearCount=0 且 lastWornDate 为空')
console.log('e2e-1.2 添加3件衣物(不同分类): OK')

// ---- 1.3 创建 2 套穿搭 ----
const outfitA = wardrobe.upsertOutfit({
  name: '通勤日装', pieces: [{ category: '上衣', itemId: item1 }, { category: '下装', itemId: item2 }],
  occasion: '通勤', note: '工作日'
})
const outfitB = wardrobe.upsertOutfit({
  name: '秋日出行', pieces: [{ category: '外套', itemId: item3 }, { category: '上衣', itemId: item1 }],
  occasion: '约会', note: ''
})
ok(!!outfitA && !!outfitB && outfitA !== outfitB, '两套穿搭应生成不同 id')
ok(wardrobe.getOutfits().length === 2, '穿搭列表应有 2 套')
const hydratedA = wardrobe.hydrateOutfit(wardrobe.getOutfit(outfitA), wardrobe.getItems())
ok(hydratedA.pieces.length === 2 && hydratedA.pieces.every((p) => p.item && p.item.name), '穿搭A 两个 piece 均应解析到衣物对象')
console.log('e2e-1.3 创建2套穿搭: OK')

// ---- 1.4 制定 7 天穿搭计划（今天及过去 6 天，保证可逐日标记） ----
const planDates = []
for (let i = 6; i >= 0; i -= 1) {
  const date = dateOffset(-i)
  planDates.push(date)
  const outfitId = i % 2 === 0 ? outfitA : outfitB
  const result = wardrobe.setOutfitPlan(date, outfitId, `第${7 - i}天`)
  ok(result.ok === true, `设置计划失败: ${date}`)
  ok(result.plan.outfitId === outfitId && result.plan.note === `第${7 - i}天`, '计划内容应正确写入')
}
const plans = wardrobe.getOutfitPlans()
ok(Object.keys(plans).length === 7, '应恰好有 7 天计划')
ok(wardrobe.getOutfitPlan(planDates[0]) && wardrobe.getOutfitPlan(planDates[0]).outfitId === outfitA, '首日计划应为穿搭A')
console.log('e2e-1.4 制定7天穿搭计划: OK')

// ---- 1.5 逐日标记穿着（markOutfitPlanWorn） ----
planDates.forEach((date) => {
  const result = wardrobe.markOutfitPlanWorn(date)
  ok(result.ok === true, `标记穿着失败: ${date} ${JSON.stringify(result)}`)
  ok(result.addedCount === 2, `每天应新增 2 件衣物记录, 实际 ${result.addedCount}`)
})
// 边界：未来日期不允许标记穿着
const tomorrow = dateOffset(1)
wardrobe.setOutfitPlan(tomorrow, outfitA, '未来计划')
const futureMark = wardrobe.markOutfitPlanWorn(tomorrow)
ok(futureMark.ok === false, '未来日期标记穿着应被拒绝')
wardrobe.deleteOutfitPlan(tomorrow)
ok(wardrobe.getOutfitPlan(tomorrow) === null, '未来计划删除后应不存在')

const wearLogs = wardrobe.getWearLogs()
ok(Object.keys(wearLogs).length === 7, '7 天应各有穿着记录')
planDates.forEach((date) => {
  ok(wearLogs[date] && wearLogs[date].length === 2, `${date} 应有 2 条穿着记录`)
})

// 衣物穿着统计：item1 每天都被穿(两套都有)，item2 只在穿搭A(4天)，item3 只在穿搭B(3天)
const i1 = wardrobe.getItem(item1)
const i2 = wardrobe.getItem(item2)
const i3 = wardrobe.getItem(item3)
ok(i1.wearCount === 7, `item1 wearCount 应为 7, 实际 ${i1.wearCount}`)
ok(i2.wearCount === 4, `item2 wearCount 应为 4, 实际 ${i2.wearCount}`)
ok(i3.wearCount === 3, `item3 wearCount 应为 3, 实际 ${i3.wearCount}`)
ok(i1.lastWornDate === dateOffset(0), 'item1 上次穿着应为今天')
console.log('e2e-1.5 逐日标记穿着: OK')

// ---- 1.6 查看周统计 ----
// 1.6.1 近 7 天穿着日历
const calendar = wardrobe.getWearCalendar(7)
ok(calendar.length === 7, '周历应有 7 天')
ok(calendar.every((day) => day.itemCount === 2), '周历每天应有 2 件穿着')
// 1.6.2 汇总统计
const summary = wardrobe.summarize(wardrobe.getItems())
ok(summary.totalCount === 3, '总衣物数应为 3')
ok(summary.totalWearCount === 14, `本周总穿着次数应为 14, 实际 ${summary.totalWearCount}`)
ok(summary.wornItemCount === 3, '3 件衣物都应有过穿着')
ok(summary.totalPrice === 159 + 299 + 599, '总价应等于三件衣物价格之和')
ok(summary.mostWornItems[0].id === item1 && summary.mostWornItems[0].wearCount === 7, '最常穿应为 item1(7次)')
// 1.6.3 首页洞察：今日穿着数 = 2；最近穿过应覆盖全部 3 件且均在今天
const insights = wardrobe.getHomeInsights()
ok(insights.todayRecordCount === 2, `今日穿着数应为 2, 实际 ${insights.todayRecordCount}`)
const recentIds = insights.recentItems.map((item) => item.id)
ok(insights.recentItems.length === 3, '最近穿过应包含全部 3 件')
ok([item1, item2, item3].every((id) => recentIds.includes(id)), '最近穿过集合应包含 item1/2/3')
// item1/item2 今天穿(穿搭A含今天), item3 昨天穿(穿搭B计划在 -5/-3/-1 天)
const lastWornMap = Object.fromEntries(insights.recentItems.map((i) => [i.id, i.lastWornDate]))
ok(lastWornMap[item1] === dateOffset(0) && lastWornMap[item2] === dateOffset(0), 'item1/item2 最近穿着应为今天')
ok(lastWornMap[item3] === dateOffset(-1), 'item3 最近穿着应为一昨天')

console.log('e2e-1.6 周统计: OK')
console.log('e2e-1 new-user: ALL PASS')
