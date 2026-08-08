// 场景2: 愿望清单全生命周期 —— 添加愿望 → 编辑价格/备注 → 购买 → 自动转为衣物 → 愿望清单清理
const assert = require('assert')
const { store, wardrobe, resetStorage, removedFiles } = require('./_mock')

function ok(condition, message) {
  if (!condition) throw new Error(`断言失败: ${message}`)
}

const today = wardrobe.formatLocalDate(new Date())

resetStorage()

// ---- 2.1 添加愿望 ----
const wishId = wardrobe.upsertWishlistItem({
  name: '羊毛大衣', category: '外套', expectedPrice: 1200, imageUrl: '', note: '双十一目标'
})
ok(!!wishId, 'upsertWishlistItem 应返回新 ID')
let wish = wardrobe.getWishlistItem(wishId)
ok(wish && wish.name === '羊毛大衣' && wish.category === '外套', '愿望应创建成功')
ok(wish.expectedPrice === 1200 && wish.note === '双十一目标', '愿望初始价格/备注应正确')
ok(wardrobe.getWishlist().length === 1, '愿望清单应有 1 条')

// 第二条用 addWishlistItem（void 返回），验证插入列表开头
wardrobe.addWishlistItem({ name: '乐福鞋', category: '鞋子', expectedPrice: 499, imageUrl: '', note: '' })
const listAfterAdd = wardrobe.getWishlist()
ok(listAfterAdd.length === 2 && listAfterAdd[0].name === '乐福鞋', '新愿望应插入列表开头')
const secondWishId = listAfterAdd[0].id
ok(!!secondWishId, 'addWishlistItem 也应生成 id')
console.log('e2e-2.1 添加愿望: OK')

// ---- 2.2 编辑价格/备注 ----
const beforeUpdatedAt = wardrobe.getWishlistItem(wishId).updatedAt
wardrobe.upsertWishlistItem({ id: wishId, expectedPrice: 999, note: '已降价' })
wish = wardrobe.getWishlistItem(wishId)
ok(wish.expectedPrice === 999, `编辑后价格应为 999, 实际 ${wish.expectedPrice}`)
ok(wish.note === '已降价', `编辑后备注应为 已降价, 实际 ${wish.note}`)
ok(wish.name === '羊毛大衣', '编辑不应影响其他字段')
ok(wish.updatedAt !== beforeUpdatedAt && wish.updatedAt > beforeUpdatedAt, '编辑后 updatedAt 应更新')
console.log('e2e-2.2 编辑价格/备注: OK')

// ---- 2.3 购买：自动转为衣物并移出愿望清单 ----
const purchase = wardrobe.purchaseWishlistItem(wishId)
ok(purchase.ok === true && !!purchase.itemId, '购买应成功并返回 itemId')
const convertedItem = wardrobe.getItem(purchase.itemId)
ok(!!convertedItem, '购买后应生成对应衣物')
ok(convertedItem.name === '羊毛大衣' && convertedItem.category === '外套', '衣物名称/分类应继承愿望')
ok(Number(convertedItem.price) === 999, `衣物价格应继承愿望 999, 实际 ${convertedItem.price}`)
ok(convertedItem.status === '偶尔穿', `购买默认状态应为 偶尔穿, 实际 ${convertedItem.status}`)
ok(convertedItem.purchaseDate === today, '购买日期应设为今天')
ok(convertedItem.note === '已降价', '备注应带入衣物')
ok(!wardrobe.getWishlistItem(wishId), '已购买愿望应从愿望清单移除')
console.log('e2e-2.3 购买并转为衣物: OK')

// ---- 2.4 另一条走「转换」路径 + 边界 ----
const convert = wardrobe.convertWishlistToItem(secondWishId)
ok(convert.ok === true && !!convert.itemId, '转换应成功')
const converted2 = wardrobe.getItem(convert.itemId)
ok(converted2.name === '乐福鞋' && converted2.category === '鞋子', '转换衣物字段应继承')
ok(Number(converted2.price) === 499, `转换衣物价格应继承 499, 实际 ${converted2.price}`)
ok(!wardrobe.getWishlistItem(secondWishId), '转换后应从愿望清单移除')
// 边界：购买不存在的愿望
ok(wardrobe.purchaseWishlistItem('no-such-wish').ok === false, '购买不存在愿望应失败')
ok(wardrobe.convertWishlistToItem('no-such-wish').ok === false, '转换不存在愿望应失败')
console.log('e2e-2.4 转换路径与边界: OK')

// ---- 2.5 愿望清单清理 ----
ok(wardrobe.getWishlist().length === 0, '购买/转换后愿望清单应清空')
// 再添加一条不想要的愿望并删除，验证 deleteWishlistItem 清理
const tempWish = wardrobe.upsertWishlistItem({ name: '临时种草', category: '包', expectedPrice: '', note: '' })
wardrobe.deleteWishlistItem(tempWish)
ok(wardrobe.getWishlist().length === 0, 'deleteWishlistItem 后清单应为空')
ok(wardrobe.getWishlistItem(tempWish) === null, '已删除愿望不应再查到')
wardrobe.deleteWishlistItem('ghost-id') // 删除不存在 ID 不应抛错
console.log('e2e-2.5 愿望清单清理: OK')
console.log('e2e-2 wishlist: ALL PASS')