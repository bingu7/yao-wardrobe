// 场景3: 数据管理链路 —— 导出含图片备份 → clearAllData → 导入备份 → 验证数据完整性
const assert = require('assert')
const { store, wardrobe, resetStorage, fileContents } = require('./_mock')

function ok(condition, message) {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return wardrobe.formatLocalDate(d)
}

async function main() {
  // ---- 3.1 造数：2 件衣物(共享图片 a.jpg) + 1 件愿望(图片 b.jpg) + 1 套穿搭 + 7 天计划 + 穿着记录 ----
  resetStorage()
  const IMG_A = 'QUFBQUJBPT0='   // 合法 base64
  const IMG_B = 'QkJCQkJCPQ=='   // 合法 base64
  fileContents.set('saved://a.jpg', IMG_A)
  fileContents.set('saved://b.jpg', IMG_B)

  const p1 = wardrobe.upsertItem({
    id: 'p1', name: '白色衬衫', category: '上衣', price: 159, imageUrl: 'saved://a.jpg',
    color: '白', seasons: ['春'], occasions: ['通勤'], purchaseDate: dateOffset(-30), status: '常穿', note: '基础款'
  })
  const p2 = wardrobe.upsertItem({
    id: 'p2', name: '深蓝牛仔裤', category: '下装', price: 299, imageUrl: 'saved://a.jpg',
    color: '深蓝', seasons: ['春', '夏'], occasions: ['通勤', '休闲'], purchaseDate: dateOffset(-30), status: '常穿', note: ''
  })
  const p3 = wardrobe.upsertItem({
    id: 'p3', name: '帆布鞋', category: '鞋子', price: 199, imageUrl: '',
    color: '米白', seasons: ['夏'], occasions: ['休闲'], purchaseDate: dateOffset(-15), status: '偶尔穿', note: ''
  })
  const pOutfit = wardrobe.upsertOutfit({
    id: 'pf1', name: '工作日套装',
    pieces: [{ category: '上衣', itemId: p1 }, { category: '下装', itemId: p2 }],
    occasion: '通勤', note: ''
  })
  // 7 天计划（今天与过去 6 天）
  for (let i = 6; i >= 0; i -= 1) {
    const date = dateOffset(-i)
    const result = wardrobe.setOutfitPlan(date, pOutfit, `day${7 - i}`)
    ok(result.ok === true, `设置计划失败 ${date}`)
  }
  // 穿着记录：昨天穿 p1+p2，前天穿 p3
  wardrobe.markWorn(p1, dateOffset(-1))
  wardrobe.markWorn(p2, dateOffset(-1))
  wardrobe.markWorn(p3, dateOffset(-2))
  wardrobe.upsertWishlistItem({
    id: 'wp1', name: '乐福鞋', category: '鞋子', expectedPrice: 699, imageUrl: 'saved://b.jpg', note: '种草'
  })

  // ---- 3.2 导出含图片备份（version 4） ----
  const backup = await wardrobe.exportDataWithImages()
  ok(backup.version === 4, '备份版本应为 4')
  const refs = Object.keys(backup.images)
  ok(refs.length === 2, `应导出 2 张去重图片, 实际 ${refs.length}`)
  const firstItem = backup.items.find((i) => i.id === p1)
  const secondItem = backup.items.find((i) => i.id === p2)
  const wishInBackup = backup.wishlist.find((w) => w.id === 'wp1')
  ok(firstItem.imageRef === secondItem.imageRef, '共享图片应使用同一 imageRef 去重')
  ok(!!wishInBackup.imageRef && wishInBackup.imageRef !== firstItem.imageRef, '愿望图片应使用独立 imageRef')
  ok(firstItem.imageUrl === '' && wishInBackup.imageUrl === '', '备份中 imageUrl 应置空')
  ok(backup.images[firstItem.imageRef].data === IMG_A, 'base64 内容应保留')
  ok(backup.outfits.length === 1 && backup.outfits[0].id === 'pf1', '穿搭应完整导出')
  ok(Object.keys(backup.outfitPlans).length === 7, '7 天计划应完整导出')
  ok(Object.keys(backup.wearLogs).length === 2, '穿着记录应完整导出')
  ok(backup.categories.includes('上衣') && backup.occasions.includes('通勤'), '分类/场合应导出')
  const validation = wardrobe.validateBackup(backup)
  ok(validation.ok === true, '导出的备份应通过 validateBackup')
  console.log('e2e-3.2 导出含图片备份: OK')

  // ---- 3.3 clearAllData：全清空并重置分类/场合 ----
  const cleared = wardrobe.clearAllData()
  ok(cleared.ok === true, 'clearAllData 应成功')
  ok(wardrobe.getItems().length === 0, '衣物应清空')
  ok(wardrobe.getOutfits().length === 0, '穿搭应清空')
  ok(wardrobe.getWishlist().length === 0, '愿望清单应清空')
  ok(Object.keys(wardrobe.getWearLogs()).length === 0, '穿着记录应清空')
  ok(Object.keys(wardrobe.getOutfitPlans()).length === 0, '穿搭计划应清空')
  const cats = wardrobe.getCustomCategories()
  const occs = wardrobe.getCustomOccasions()
  ok(cats.length === wardrobe.defaultCategories.length && cats.every((c, i) => c === wardrobe.defaultCategories[i]), '分类应重置为默认')
  ok(occs.length === wardrobe.defaultOccasions.length && occs.every((o, i) => o === wardrobe.defaultOccasions[i]), '场合应重置为默认')
  console.log('e2e-3.3 clearAllData: OK')

  // ---- 3.4 导入备份并验证数据完整性 ----
  const importResult = await wardrobe.importDataWithImages(backup)
  ok(importResult.ok === true, `导入应成功: ${JSON.stringify(importResult)}`)
  ok(importResult.merged === true && importResult.count === 3 && importResult.imageCount === 2,
    `导入统计应正确: ${JSON.stringify(importResult)}`)

  // 3.4.1 衣物完整性（含 ID、名称、分类、价格、状态、备注）
  const restored = wardrobe.getItems()
  ok(restored.length === 3, '应恢复 3 件衣物')
  const r1 = wardrobe.getItem(p1)
  const r2 = wardrobe.getItem(p2)
  const r3 = wardrobe.getItem(p3)
  ok(r1.name === '白色衬衫' && r1.category === '上衣' && r1.price === 159 && r1.note === '基础款', 'p1 字段应完整恢复')
  ok(r2.name === '深蓝牛仔裤' && r2.category === '下装' && r2.occasions.includes('休闲'), 'p2 字段应完整恢复')
  ok(r3.name === '帆布鞋' && r3.status === '偶尔穿', 'p3 字段应完整恢复')
  // 3.4.2 图片恢复：imageRef 替换为本地路径，共享引用指向同一文件
  ok(r1.imageUrl.startsWith('wxfile://usr/wardrobe-images/restore-'), `p1 图片应恢复为本地路径: ${r1.imageUrl}`)
  ok(r1.imageUrl === r2.imageUrl, '共享图片应恢复为同一本地文件')
  ok(r3.imageUrl === '', '无图衣物不应有图片')
  const wl = wardrobe.getWishlist()
  ok(wl.length === 1 && wl[0].name === '乐福鞋' && wl[0].imageUrl.startsWith('wxfile://usr/wardrobe-images/restore-'), '愿望及图片应恢复')
  ok(r1.imageRef === undefined && wl[0].imageRef === undefined, '恢复后不应残留 imageRef')
  // 图片文件实体写入成功
  ok(fileContents.has(r1.imageUrl), '恢复图片文件应实际写入')
  // 3.4.3 穿搭与计划
  ok(wardrobe.getOutfit('pf1').pieces.length === 2, '穿搭 pieces 应恢复')
  const restoredPlans = wardrobe.getOutfitPlans()
  ok(Object.keys(restoredPlans).length === 7, '7 天计划应恢复')
  ok(restoredPlans[dateOffset(-1)].outfitId === 'pf1', '昨天计划应恢复')
  // 3.4.4 穿着统计
  ok(Object.keys(wardrobe.getWearLogs()).length === 2, '穿着记录应恢复')
  ok(wardrobe.getWearLog(dateOffset(-1)).length === 2, '昨天应恢复 2 条穿着')
  ok(r1.wearCount === 1 && r1.lastWornDate === dateOffset(-1), 'p1 穿着统计应恢复')
  ok(r3.wearCount === 1 && r3.lastWornDate === dateOffset(-2), 'p3 穿着统计应恢复')
  // 3.4.5 分类/场合完整性
  ok(wardrobe.getCustomCategories().includes('上衣') && wardrobe.getCustomCategories().includes('下装'), '自定义分类应恢复')
  ok(wardrobe.getCustomOccasions().includes('通勤') && wardrobe.getCustomOccasions().includes('休闲'), '自定义场合应恢复')
  console.log('e2e-3.4 导入并验证数据完整性: OK')

  console.log('e2e-3 backup: ALL PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})