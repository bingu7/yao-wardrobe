# 瑶的衣柜 — 端到端场景串联测试报告（E2E）

- 执行时间：2026-08-06 01:10（UTC+8）
- 运行环境：Node.js v24.12.0，微信小程序 wx mock（tests/_mock.js）
- 被测对象：utils/wardrobe.js 数据层（70 个导出 API 的业务链路）
- 依据：docs/API.md；基于 T1（数据迁移）与 T2（回归）测试框架扩展

## 结论

**4 个场景全部通过（4/4），共 135 个断言。** 未发现新的产品缺陷。

| 场景 | 脚本 | 关键检查点（断言数） | 结果 |
| --- | --- | --- | --- |
| 1 新用户首次使用 | tests/e2e-1-new-user.test.js | 35 | 通过 |
| 2 愿望清单全生命周期 | tests/e2e-2-wishlist.test.js | 28 | 通过 |
| 3 数据管理链路 | tests/e2e-3-backup.test.js | 42 | 通过 |
| 4 衣柜维护 | tests/e2e-4-maintenance.test.js | 30 | 通过 |

## 场景明细

### 场景1：新用户首次使用（e2e-1）
空衣柜 → upsertItem 添加 3 件不同分类衣物（上衣/下装/外套）→ upsertOutfit 创建 2 套穿搭 → setOutfitPlan 制定今天起回溯 7 天计划 → markOutfitPlanWorn 逐日标记穿着 → 查看周统计。

验证要点：
- 空衣柜：getItems() 返回空数组
- 3 件衣物分类互异，初始 wearCount=0、lastWornDate=''
- 7 天计划落盘；每天标记穿着 addedCount=2
- 穿着统计精确：item1(两套都有)=7 次、item2(穿搭A)=4 次、item3(穿搭B)=3 次；totalWearCount=14
- 边界：未来日期计划标记穿着被拒绝（{ok:false}），删除未来计划后 getOutfitPlan 返回 null
- 周统计：getWearCalendar(7) 每天 itemCount=2；summarize.totalWearCount=14、wornItemCount=3、mostWornItems[0] 为 item1(7次)；getHomeInsights.todayRecordCount=2

### 场景2：愿望清单全生命周期（e2e-2）
添加（upsertWishlistItem / addWishlistItem 双路径）→ 编辑价格/备注 → purchaseWishlistItem 购买自动转衣物 → convertWishlistToItem 转换路径 → deleteWishlistItem 清理。

验证要点：
- upsertWishlistItem 返回 ID；addWishlistItem 新项插列表开头
- 编辑 expectedPrice 1200→999、note 更新，其余字段不受影响，updatedAt 递增
- 购买后：生成衣物（名称/分类/价格/备注继承，status='偶尔穿'，purchaseDate=今天），愿望自动移出清单
- 转换路径：字段继承，expectedPrice → price
- 边界：购买/转换不存在的愿望均返回 {ok:false}
- 清理：清单最终为空；删除不存在 ID 不抛错

### 场景3：数据管理链路（e2e-3）
exportDataWithImages → clearAllData → importDataWithImages → 完整性校验。

验证要点：
- v4 备份：version=4、图片去重共享 imageRef（2 件衣物共享 1 图+愿望 1 图）、imageUrl 置空、base64 保留、穿搭/7 天计划/穿着记录/分类/场合完整、通过 validateBackup
- clearAllData：衣物/穿搭/愿望/穿着记录/计划全清空，分类/场合重置为默认值
- 导入：count=3、imageCount=2；共享图片恢复为同一本地路径（wxfile://usr/wardrobe-images/restore-*），无图衣物保持无图；imageRef 无残留；恢复文件实体写入文件系统
- 穿着统计恢复：wearCount/lastWornDate 修正一致

### 场景4：衣柜维护（e2e-4）
batchUpdateCategory → batchAddOccasions → 闲置检测（getIdleStatus/首页 staleItems）→ batchDeleteItems 清理。

验证要点：
- 批量改分类：命中 ID 更新、未命中不受影响、忽略 ghost-id
- 批量加场合：追加去重、保留已有场合、未命中不受影响
- 闲置提醒：从未穿过→isIdle（'暂未记录穿着'）；100 天未穿(阈值60)→isIdle（'已 N 天未穿'）；昨天穿→非闲置；首页 staleItems 精确命中 3 件闲置
- 批量删除：count=2，级联清理穿着日志中的已删衣物；删除后 staleItems 只剩 1 件
- 边界：空 ID 列表/空分类/空场合均返回 {ok:false}

## 与本任务无关的既有失败（T1/T2 已确认缺陷，未恶化）

| 测试 | 缺陷 ID | 说明 |
| --- | --- | --- |
| migration-1-legacy-outfit.test.js | WARDROBE-BUG-1 / B1 | getOutfits() 旧格式迁移结果未回写存储 |
| migration-7-cache.test.js | WARDROBE-BUG-2 / B2 | 损坏缓存数组内 null 元素导致 TypeError 崩溃 |
| regression.test.js（5 项） | B1~B5 | 上述 2 项 + null 入参防护缺失（getCostPerWear/getIdleStatus/enrichItemForDisplay/addWishlistItem） |

修复建议：优先处理 B2（P1，崩溃级），其次 B1（迁移落盘），B3~B5 为入参防护增强。

## 产物

- 测试脚本：tests/e2e-1-new-user.test.js、tests/e2e-2-wishlist.test.js、tests/e2e-3-backup.test.js、tests/e2e-4-maintenance.test.js
- 运行日志：e2e-run.log / full-suite.log（见 kanban 任务附件）
- 运行方式：`node tests/e2e-N-*.test.js`（复用 tests/_mock.js wx mock，无需微信开发者工具）