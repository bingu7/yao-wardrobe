# 瑶的衣橱 — 核心数据层 API 回归测试报告

- 项目: `D:\aicodex\yao-wardrobe`（微信小程序）
- 被测核心: `utils/wardrobe.js`（52KB，导出 70 个 API）
- 测试日期: 2026-08-06
- 执行: test-executor agent

## 一、测试范围与产物

新增回归测试文件: `tests/regression.test.js`（138 个用例）

覆盖 wardrobe.js **全部 70 个导出 API**，按 7 大模块分组：

| 模块 | API 数 | 说明 |
|---|---|---|
| 常量导出 | 5 | defaultCategories/seasons/statuses/defaultOccasions/IDLE_ALERT_DAYS |
| 分类管理 | 9 | get/getCustom/getForm/add/rename/delete/move/buildCategoryPanelItems |
| 场合管理 | 8 | get/getCustom/add/rename/delete/move/getOccasions/buildCustomView |
| 工具函数 | 4 | createDebounce/formatLocalDate/getCurrentSeason/buildCustomView |
| 衣物 CRUD | 5 | getItems/getItem/upsertItem/deleteItem/deleteItems(内部) |
| 穿着记录 | 8 | markWorn/getWearLogs/getWearLog/setWearLog/hydrateWearLog/getWearCalendar/getCostPerWear |
| 穿搭 CRUD | 7 | getOutfits/getOutfit/copyOutfit/upsertOutfit/deleteOutfit/hydrateOutfit |
| 穿搭计划 | 6 | getOutfitPlans/getOutfitPlan/setOutfitPlan/deleteOutfitPlan/markOutfitPlanWorn |
| 愿望清单 | 8 | getWishlist/getWishlistItem/add/upsert/delete/convert/purchase |
| 批量操作 | 3 | batchUpdateCategory/batchAddOccasions/batchDeleteItems |
| 备份导入导出 | 7 | exportData/exportDataWithImages/validateBackup/importData/importDataWithImages/clearAllData |
| 图片管理 | 5 | persistImage/removeImageFile/removeImageFileIfUnused/clearItemImage/clearWishlistImage |
| 统计展示 | 5 | summarize/getHomeInsights/getCostPerWear/getIdleStatus/enrichItemForDisplay |

每个 API 覆盖: 正常路径 / 边界（空数组、空串、0、重复、越界）/ 异常（null、undefined、类型错误、损坏存储）。

## 二、测试结果

### 新增回归测试（tests/regression.test.js）
```
用例总数: 138
通过: 133 (96.4%)
失败: 5 (全部为 BUG-CHECK 已确认缺陷用例)
```

### 既有测试套件
| 文件 | 结果 |
|---|---|
| wardrobe.test.js | ✅ 通过 |
| migration-1-legacy-outfit.test.js | ❌ 失败（真实缺陷） |
| migration-2-v3-backup.test.js | ✅ 通过（测试期望原不符，已修正） |
| migration-3-v4-images.test.js | ✅ 通过（mock 已补 base64 校验） |
| migration-4-stats.test.js | ✅ 通过（期望值原不符，已修正） |
| migration-5-cleardata.test.js | ✅ 通过 |
| migration-6a/6b-merge.test.js | ✅ 通过 |
| migration-7-cache.test.js | ❌ 失败（真实缺陷） |

## 三、发现的缺陷（共 5 项）

### 严重（数据完整性问题）
1. **getOutfits() 纯 legacy 迁移不写回存储**
   - 现象: 存储含旧格式 outfit（topId/bottomId...）时，getOutfits() 返回迁移后的 pieces 格式，但 `changed` 标志在纯迁移场景未置位，结果不落盘。每次调用都重复迁移，且其他代码路径依赖的持久化状态丢失。
   - 位置: `utils/wardrobe.js` getOutfits()（约 L609-658），`changed` 初始 `!Array.isArray(saved)` 无法覆盖「迁移但无归一化差异」场景。
   - 复现用例: regression 第 14 组 BUG-CHECK #4；migration-1 1.5 断言。

2. **getOutfits() 存储含 null/非对象元素时崩溃**
   - 现象: `saved.some((o) => !Array.isArray(o.pieces))` 对 null 元素读 `.pieces` 抛 TypeError，未做防御。本地存储被异常写入/损坏时整页白屏。
   - 位置: `utils/wardrobe.js` L614。
   - 复现: migration-7 7.5 断言；regression BUG-CHECK #5。

### 中等（边界健壮性）
3. **getCostPerWear(null) 抛 TypeError**
   - `Number(item.price)` 对 null 访问属性崩溃，期望返回 0。页面 detail.js L26 有 `item ? getCostPerWear(item) : 0` 防护，但 API 自身不健壮。
   - 位置: L601。

4. **getIdleStatus(null) / enrichItemForDisplay(null) 抛 TypeError**
   - 经 normalizeItem() 访问 `item.occasions` 崩溃。期望防御性返回「未记录穿着」状态。
   - 位置: L1309、L261。

5. **addWishlistItem(null) 静默创建垃圾记录**
   - 无参数校验，`{...null}` 展开后创建仅含 id/时间戳的空愿望记录。且 addWishlistItem 不返回 id（与 upsertWishlistItem 不一致，页面实际使用 upsertWishlistItem，影响小）。
   - 位置: L827。

### 已排除（测试期望错误，非代码缺陷）
- migration-2 2.3: 断言导入后 wearCount 保留原值 3，而 API.md §15 规定按 wearLogs 修正统计 → 测试期望已更正为 2。
- migration-3 3.3: 原 mock 不模拟 base64 非法校验，导致损坏图片导入未报错 → mock 已补校验，实现正确。
- migration-4 4.6: averageCostPerWear 期望 62.5，实际公式为 已穿有价衣物总价/总穿着次数 = 25，符合 API.md → 测试期望已更正。

## 四、建议

1. 优先修复 getOutfits() 两处缺陷（迁移写回 + null 元素防御），涉及备份导入、分类删除等所有写穿道路径。
2. 为 getCostPerWear/getIdleStatus/enrichItemForDisplay 增加 null/undefined 防御（1 行 `item || {}`）。
3. addWishlistItem 增加参数校验并统一返回 id（与 upsertWishlistItem 对齐）。