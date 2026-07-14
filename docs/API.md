# yao-wardrobe API 文档

本文档面向维护和扩展 `yao-wardrobe` 微信小程序的开发者，描述当前代码中的完整接口。

## 1. API 范围

项目是纯前端原生微信小程序，没有服务端、云函数、`wx.request` 调用或 HTTP API，也没有登录、令牌或其他鉴权协议。

本文档覆盖三类开发接口：

1. [`utils/wardrobe.js`](../utils/wardrobe.js) 通过 CommonJS 导出的 64 个成员（5 个常量、59 个函数）；
2. 页面之间的路由和临时存储约定；
3. 项目实际依赖的微信小程序运行时 API。

页面对象中的事件处理函数只供对应 WXML 页面调用，不属于可复用模块 API，因此不逐个列为公共接口。

## 2. 快速开始

```js
const wardrobe = require('../../utils/wardrobe')

const items = wardrobe.getItems()
const id = wardrobe.upsertItem({
  name: '白色衬衫',
  category: '上衣',
  price: 159,
  imageUrl: '',
  color: '白色',
  seasons: ['春', '秋'],
  occasions: ['通勤'],
  purchaseDate: '2026-07-13',
  status: '常穿',
  note: ''
})

wardrobe.markWorn(id)
```

`persistImage()`、`exportDataWithImages()` 和 `importDataWithImages()` 返回 `Promise`，`removeImageFile()` 使用异步回调；其他业务模块接口均为同步接口。数据直接存放在微信本地缓存和用户文件目录中。

## 3. 通用约定

### 3.1 日期和时间

- 本地业务日期使用 `YYYY-MM-DD`，例如 `2026-07-13`。
- `createdAt`、`updatedAt` 和 `exportedAt` 使用 `new Date().toISOString()` 生成的 ISO 8601 UTC 时间。
- 季节按自然月映射：3—5 月为春，6—8 月为夏，9—11 月为秋，其余月份为冬。

### 3.2 写操作结果

执行参数校验的写接口通常返回以下联合类型：

```ts
type OperationResult<T extends object = {}> =
  | ({ ok: true } & T)
  | { ok: false; message: string }
```

并非所有写接口都使用该结果类型。`upsertItem()`、`upsertOutfit()` 和 `upsertWishlistItem()` 返回 ID；部分删除接口返回 `void`。调用方应按各接口的具体说明处理。

### 3.3 初始化和引用语义

- 第一次调用 `getItems()` 和 `getOutfits()` 会分别写入并返回空数组，不内置示例数据。
- `getWishlist()` 和 `getWearLogs()` 在无数据时分别返回空数组和空对象。
- 读取接口通常直接返回缓存对象或数组，没有深拷贝。不要直接修改返回值；应通过对应写接口持久化变更。

## 4. 数据模型

以下类型是根据当前 JavaScript 实现归纳的开发契约，不代表运行时存在 TypeScript 校验。

### 4.1 WardrobeItem

```ts
interface WardrobeItem {
  id: string
  imageUrl: string
  name: string
  category: string
  price: number | ''
  color: string
  seasons: string[]
  occasions: string[]
  purchaseDate: string       // YYYY-MM-DD
  status: string
  wearCount: number
  lastWornDate: string       // YYYY-MM-DD 或空字符串
  note: string
  createdAt: string          // ISO 8601
  updatedAt: string          // ISO 8601
}
```

`normalizeItem()` 是内部函数，会保证 `seasons`、`occasions` 为数组，`wearCount` 为数字，`lastWornDate` 至少为空字符串。

### 4.2 Outfit 和 OutfitPiece

```ts
interface OutfitPiece {
  category: string
  itemId: string
}

interface Outfit {
  id: string
  name: string
  pieces: OutfitPiece[]
  occasion: string
  note: string
  createdAt: string
  updatedAt: string
}

interface HydratedOutfitPiece extends OutfitPiece {
  item: WardrobeItem | null
  imageUrl: string
  name: string              // 衣物不存在时为“未选择”
}
```

读取穿搭时会自动把旧版 `topId`、`bottomId`、`shoesId`、`bagId`、`accessoryId` 字段迁移成 `pieces`。

### 4.3 WishlistItem

```ts
interface WishlistItem {
  id: string
  imageUrl: string
  name: string
  category: string
  expectedPrice: number | ''
  matchItemId: string
  note: string
  createdAt: string
  updatedAt: string
}
```

### 4.4 WearLogs

```ts
type WearLogs = Record<string, string[]>
// 键：YYYY-MM-DD；值：当天穿过的衣物 ID，接口层会去重并移除空 ID。
```

### 4.5 BackupData

```ts
interface BackupData {
  version: 3 | 4
  exportedAt: string
  items: Array<WardrobeItem & { imageRef?: string }>
  outfits: Outfit[]
  wishlist: Array<WishlistItem & { imageRef?: string }>
  wearLogs: WearLogs
  categories: string[]
  occasions: string[]
  images?: Record<string, { extension: string; data: string }>
}
```

版本 3 是不含图片内容的普通 JSON 备份；版本 4 使用 `imageRef` 引用 `images` 中的 Base64 图片，可在另一台设备恢复为新的本地文件。

## 5. 导出常量

| 成员 | 类型 | 当前值 | 说明 |
| --- | --- | --- | --- |
| `defaultCategories` | `string[]` | 连衣裙、上衣、下装、外套、鞋子、包包、帽子/发饰、配饰、其他 | 首次分类迁移和备份导入时的默认分类 |
| `seasons` | `string[]` | 春、夏、秋、冬 | 衣物季节选项 |
| `statuses` | `string[]` | 常穿、偶尔穿、闲置 | 衣物状态选项 |
| `defaultOccasions` | `string[]` | 通勤、约会、旅行、拍照、正式、休闲、运动 | 首次场合迁移和备份导入时的默认场合 |
| `IDLE_ALERT_DAYS` | `number` | `60` | 默认闲置提醒阈值 |

## 6. 分类 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `getCategories(items)` | `string[]` | 从传入衣物提取非空分类并去重，结果首项固定为 `全部`。要求显式传入数组。 |
| `getCustomCategories()` | `string[]` | 读取受管理的分类列表。首次调用会合并默认分类与旧缓存，去重后回写。 |
| `getFormCategories()` | `string[]` | `getCustomCategories()` 的表单语义别名。 |
| `addCustomCategory(category)` | `OperationResult<{ category: string }>` | 去除首尾空白后新增分类。拒绝空值、`全部` 和重复项。 |
| `deleteCustomCategory(category)` | `OperationResult` | 删除分类；`其他` 不可删除。使用该分类的衣物和愿望会改为 `其他`。 |
| `renameCustomCategory(oldCategory, newCategory)` | `OperationResult<{ category: string }>` | 重命名分类，并同步衣物和愿望。拒绝重命名 `其他`、把分类改成 `全部` 或制造重复项。新旧名称相同视为成功。 |
| `moveCustomCategory(category, offset)` | `OperationResult` | 将分类移动 `offset` 个位置；越界或分类不存在时返回 `{ ok: false, message: '已经到头了' }`。 |
| `buildCategoryPanelItems(categories, customCategories, selectedCategory)` | `CategoryPanelItem[]` | 为分类管理面板构建选中态、草稿名和上下移动状态。当前版本保留 `customCategories` 参数，但实现没有读取它。 |
| `buildCustomView(items, showAll, limit?)` | `{ visibleItems, hiddenCount, toggleText }` | 构建展开/收起视图。`limit` 默认是 `2`；传 `0` 也会回退为 `2`。 |

`CategoryPanelItem` 结构：

```ts
interface CategoryPanelItem {
  name: string
  draftName: string
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  sortIndex: number
}
```

## 7. 场合 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `getCustomOccasions()` | `string[]` | 读取场合列表。首次调用会合并默认场合、旧缓存和衣物已有场合，去重后回写。 |
| `getOccasions()` | `string[]` | `getCustomOccasions()` 的业务语义别名。 |
| `addCustomOccasion(occasion)` | `OperationResult<{ occasion: string }>` | 去除首尾空白后新增场合；拒绝空值和重复项。 |
| `deleteCustomOccasion(occasion)` | `OperationResult` | 删除场合，并从所有衣物的 `occasions` 中移除；穿搭使用该场合时会清空 `outfit.occasion`。 |
| `renameCustomOccasion(oldOccasion, newOccasion)` | `OperationResult<{ occasion: string }>` | 重命名场合，并同步衣物和穿搭；拒绝空值和重复项。新旧名称相同视为成功。 |
| `moveCustomOccasion(occasion, offset)` | `OperationResult` | 将场合移动 `offset` 个位置；越界或场合不存在时返回失败结果。 |

## 8. 通用辅助 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `createDebounce(wait?)` | `(fn: Function) => void` | 返回防抖调度函数，只执行最后一次传入的回调。默认等待 `300 ms`；`wait = 0` 也会使用默认值。 |
| `formatLocalDate(date)` | `string` | 使用本地时区把有效的 `Date` 格式化为 `YYYY-MM-DD`。 |
| `getCurrentSeason(date?)` | `string` | 返回春、夏、秋或冬；省略参数时使用当前日期。 |

## 9. 图片文件 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

### `persistImage(tempFilePath)`

把微信媒体选择器返回的临时文件保存为持久文件。

- 参数：`tempFilePath: string`
- 返回：`Promise<string>`
- 成功：解析为 `savedFilePath`
- 失败：拒绝 Promise，并把微信 API 的错误交给调用方处理

### `removeImageFile(filePath)`

删除不再使用的持久图片。`USER_DATA_PATH` 内文件通过文件系统删除，其他持久文件会先查询保存列表再删除。

- 参数：`filePath: string`
- 返回：`void`
- 空路径直接返回；查询或删除失败不会向调用方报告。

### `clearItemImage(id, imageUrl?)` / `clearWishlistImage(id, imageUrl?)`

在图片加载失败时清空对应记录的 `imageUrl` 并删除失效文件。可选的 `imageUrl` 用于避免旧的加载失败事件误删刚更新的图片；成功返回 `true`，记录不存在或路径已变化时返回 `false`。

## 10. 衣物 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `getItems()` | `WardrobeItem[]` | 读取衣物；缓存不是数组时写入并返回空数组。 |
| `getItem(id)` | `WardrobeItem \| null` | 按 ID 查找并规范化衣物。 |
| `upsertItem(item)` | `string` | 无 `id` 时创建并返回新 ID；有 `id` 时更新同 ID 衣物并返回该 ID。自动维护时间戳。 |
| `deleteItem(id)` | `number` | 删除衣物和不再被引用的持久图片；从穿搭中移除相关 piece、清空愿望的 `matchItemId`，并从所有穿着日志中移除该 ID。返回实际删除数量。 |
| `getCostPerWear(item)` | `number` | 返回四舍五入到两位小数的 `price / wearCount`；价格或次数为 `0`/无效值时返回 `0`。 |

给 `upsertItem()` 传入一个不存在的 `id` 时，会按该 ID 创建记录，便于导入和迁移旧数据。

## 11. 穿着记录 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `getWearLogs()` | `WearLogs` | 读取全部日志；缓存不是非数组对象时返回 `{}`。 |
| `getWearLog(dateText)` | `string[]` | 返回指定日期的去重衣物 ID 列表；不存在时返回 `[]`。 |
| `setWearLog(dateText, itemIds)` | `OperationResult<{ date: string; changed: boolean }>` | 覆盖某天记录，并按新增/移除差异更新衣物的 `wearCount`、`lastWornDate` 和 `updatedAt`。日期无效时失败。 |
| `markWorn(id, dateText?)` | `{ ok: true; date: string; alreadyRecorded: boolean; changed?: boolean } \| { ok: false; message: string; alreadyRecorded: false }` | 把衣物加入指定日期，默认今天。同一天重复记录不会增加次数。 |
| `hydrateWearLog(dateText, items?)` | `WardrobeItem[]` | 把日志中的 ID 解析成衣物对象，过滤已不存在的衣物；省略 `items` 时读取全部衣物。 |
| `getWearCalendar(days?)` | `WearCalendarDay[]` | 从今天起倒序生成日历摘要，默认 `21` 天；传 `0` 仍使用默认值。 |

`setWearLog()` 不校验每个 ID 是否对应现有衣物。未知 ID 会保留在日志中，但不会更新任何衣物计数。

```ts
interface WearCalendarDay {
  date: string
  monthDay: string
  itemCount: number
  names: string             // 衣物名称以“、”连接
}
```

## 12. 穿搭 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `getOutfits()` | `Outfit[]` | 读取穿搭；首次读取写入空数组。发现旧固定槽位格式时会迁移，并移除重复或已失效的衣物引用后回写 `pieces`。 |
| `getOutfit(id)` | `Outfit \| null` | 按 ID 查找穿搭。 |
| `copyOutfit(id)` | `Omit<Outfit, 'id' \| 'createdAt' \| 'updatedAt'> \| null` | 返回适合创建副本的浅拷贝；原穿搭不存在时返回 `null`。 |
| `upsertOutfit(outfit)` | `string` | 无 `id` 时创建；有 `id` 时更新。返回新 ID 或传入 ID，并维护时间戳。 |
| `deleteOutfit(id)` | `void` | 删除同 ID 穿搭；不存在时无操作。 |
| `hydrateOutfit(outfit, items)` | `Outfit & { pieces: HydratedOutfitPiece[] }` | 用显式传入的衣物数组补全每个 piece 的对象、图片和名称。 |

与衣物接口一致，给 `upsertOutfit()` 传入不存在的 `id` 会按该 ID 创建记录。

## 13. 愿望清单 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `getWishlist()` | `WishlistItem[]` | 读取愿望清单；缓存无效时返回 `[]`。 |
| `getWishlistItem(id)` | `WishlistItem \| null` | 按 ID 查找愿望。 |
| `addWishlistItem(item)` | `void` | 创建愿望，自动生成 ID 和时间戳并插入列表开头。该接口不返回新 ID。 |
| `upsertWishlistItem(item)` | `string` | 无 `id` 时创建并返回新 ID；有 `id` 时更新并返回该 ID。 |
| `deleteWishlistItem(id)` | `void` | 删除愿望；愿望有图片时一并请求删除持久文件。 |
| `convertWishlistToItem(id)` | `OperationResult<{ itemId: string }>` | 把愿望转换为衣物并移出愿望清单。名称、分类、图片、预计价格和备注会被带入；购买日期设为今天。 |
| `purchaseWishlistItem(id)` | `OperationResult<{ itemId: string }>` | 把愿望标记为已购买并转换为衣物，默认状态为 `偶尔穿`，随后从愿望清单移除。 |

给 `upsertWishlistItem()` 传入不存在的 `id` 会按该 ID 创建记录。转换或购买愿望时，新衣物继续使用原愿望的图片路径，不会删除该图片。

## 14. 批量操作 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

| 接口 | 返回值 | 行为 |
| --- | --- | --- |
| `batchUpdateCategory(ids, category)` | `OperationResult` | 去重衣物 ID 后批量覆盖分类；ID 列表或分类为空时失败。未知 ID 被忽略。 |
| `batchAddOccasions(ids, occasions)` | `OperationResult` | 向选中衣物追加去重后的场合，不移除已有场合；参数为空时失败。 |
| `batchDeleteItems(ids)` | `OperationResult<{ count: number }>` | 一次性删除去重后的衣物并完成穿搭、愿望、穿着记录和图片引用清理，返回实际删除数量。 |

## 15. 备份 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

### `exportData()`

- 参数：无
- 返回：`BackupData`
- 行为：同步读取全部业务数据并生成版本为 `3` 的可序列化快照。衣物和愿望的 `imageUrl` 会置空，避免导出仅在本机有效的路径。

### `exportDataWithImages()`

- 参数：无
- 返回：`Promise<BackupData>`
- 行为：生成版本为 `4` 的完整备份，把衣物和愿望图片读取为 Base64 并按 `imageRef` 去重写入 `images`。任一图片无法读取时拒绝 Promise，避免生成不完整备份。

### `validateBackup(input)`

- 参数：JSON 字符串或对象
- 返回：`{ ok: true, backup: BackupData } | { ok: false, message: string }`
- 行为：校验必要集合、记录 ID、穿着日期以及图片引用和 Base64 内容。

### `importData(input)`

- 参数：JSON 字符串或对象
- 返回：`OperationResult`
- 行为：校验后按 ID 和 `updatedAt` 合并衣物、穿搭和愿望；穿着记录、分类和场合取并集，并修正衣物穿着统计。
- 含 `imageRef` 的版本 4 备份会被拒绝，并提示改用图片恢复方式。

### `importDataWithImages(input)`

- 参数：JSON 字符串或对象
- 返回：`Promise<OperationResult<{ count: number; merged: true; imageCount?: number }>>`
- 行为：把版本 4 的 Base64 图片写入 `USER_DATA_PATH/wardrobe-images`，替换为新本地路径后合并数据；失败时清理本次已创建的文件。旧版无图备份也可直接导入。

### `clearAllData()`

- 参数：无
- 返回：`{ ok: true }`
- 行为：删除衣物和愿望引用的本地图片，清空业务数据，并把分类、场合重置为默认值。

导入采用“较新记录覆盖较旧记录”的合并策略，不会无条件覆盖本机较新的修改；图片文件写入失败时会回收本轮临时文件。

## 16. 展示和统计 API

源码：[`utils/wardrobe.js`](../utils/wardrobe.js)

### `getIdleStatus(item, idleDays?)`

返回衣物闲置状态。阈值默认使用 `IDLE_ALERT_DAYS`；传 `0` 也会回退到默认值。

```ts
interface IdleStatus {
  isIdle: boolean
  label: string            // 闲置时为“可能闲置”
  text: string             // “还没记录穿着”“N 天没穿”“N 天前”或“未记录”
}
```

从未穿着的衣物始终被视为闲置；已穿着衣物在 `daysSince >= idleDays` 时被视为闲置。

### `enrichItemForDisplay(item)`

规范化衣物并添加：

```ts
{
  idleStatus: IdleStatus,
  statusHint: string,
  idleText: string
}
```

### `getHomeInsights(items?)`

生成首页洞察。省略 `items` 时读取全部衣物。

```ts
interface HomeInsights {
  currentSeason: string
  recentItems: WardrobeItem[]       // 最近穿过的最多 4 件
  staleItems: WardrobeItem[]        // 可能闲置的最多 4 件
  weeklyItems: WardrobeItem[]       // 本周建议的最多 4 件
  todayRecordCount: number
}
```

本周建议优先从当前季节衣物中选取超过 7 天未穿或从未穿过的衣物，并优先展示穿着次数少、上次穿着更早的记录。

### `summarize(items)`

对显式传入的衣物数组生成统计结果：

```ts
interface WardrobeSummary {
  totalCount: number
  totalPrice: number
  averagePrice: number
  idleCount: number
  neverWornCount: number
  idleOver90Count: number
  totalWearCount: number
  wornItemCount: number
  averageCostPerWear: number
  categoryCounts: Array<{ category: string; count: number }>
  seasonCounts: Array<{ season: string; count: number }>
  occasionCounts: Array<{ occasion: string; count: number }>
  mostWornItems: Array<{
    id: string
    name: string
    category: string
    wearCount: number
  }>
  highestCostPerWearItems: Array<{
    id: string
    name: string
    category: string
    costPerWear: number
  }>
}
```

补充规则：

- `averagePrice` 只统计价格大于 `0` 的衣物，并四舍五入为整数。
- `idleCount` 只统计 `status === '闲置'`。
- `idleOver90Count` 把从未穿过的衣物也计入；已穿衣物需要超过 90 天，即 `> 90`，不是 `>= 90`。
- 最常穿和最高单次穿着成本榜单最多各返回 5 条。

## 17. 页面路由和临时状态约定

页面清单来自 [`app.json`](../app.json)。

| 页面 | 类型 | 进入约定 |
| --- | --- | --- |
| `/pages/wardrobe/wardrobe` | Tab | 衣橱首页 |
| `/pages/add/add` | Tab | 新增衣物；编辑时先写入 `wardrobeEditingId` 再切换 Tab |
| `/pages/outfits/outfits` | Tab | 穿搭列表 |
| `/pages/wishlist/wishlist` | Tab | 愿望清单 |
| `/pages/stats/stats` | Tab | 统计和设置入口 |
| `/pages/detail/detail?id=<itemId>` | 普通页 | URL 查询参数 `id` 必填 |
| `/pages/outfit-form/outfit-form` | 普通页 | 编辑用 `outfitEditingId`；复制用 `outfitCopyData` |
| `/pages/wear-calendar/wear-calendar` | 普通页 | 无参数 |
| `/pages/wish-form/wish-form` | 普通页 | 编辑用 `wishlistEditingId` |
| `/pages/settings/settings` | 普通页 | 数据说明、完整备份恢复、隐私协议和清空数据 |
| `/pages/legal/legal?type=<privacy|agreement>` | 普通页 | 隐私政策或用户协议 |

这些临时键由目标页读取后立即通过 `wx.removeStorageSync()` 删除。

## 18. 本地存储键

| 键 | 值类型 | 用途 |
| --- | --- | --- |
| `privateWardrobeItems` | `WardrobeItem[]` | 衣物 |
| `privateWardrobeOutfits` | `Outfit[]` | 穿搭 |
| `privateWardrobeWishlist` | `WishlistItem[]` | 愿望 |
| `privateWardrobeWearLogs` | `WearLogs` | 按日期记录穿着 |
| `privateWardrobeCustomCategories` | `string[]` | 分类及顺序 |
| `privateWardrobeCategoriesManaged` | `boolean` | 分类是否已迁移到受管理格式 |
| `privateWardrobeCustomOccasions` | `string[]` | 场合及顺序 |
| `privateWardrobeOccasionsManaged` | `boolean` | 场合是否已迁移到受管理格式 |
| `wardrobeEditingId` | `string` | 衣物编辑页临时交接 |
| `outfitEditingId` | `string` | 穿搭编辑页临时交接 |
| `outfitCopyData` | `object` | 穿搭复制页临时交接 |
| `wishlistEditingId` | `string` | 愿望编辑页临时交接 |

## 19. 微信小程序平台 API 依赖

项目通过全局 `App()` 注册应用，通过 `Page()` 注册页面，并使用以下微信运行时能力。平台接口的通用说明见[微信小程序 API 官方文档](https://developers.weixin.qq.com/miniprogram/dev/api/)。

| 平台 API | 项目用途 |
| --- | --- |
| `wx.getStorageSync` | 读取业务缓存和页面间临时状态 |
| `wx.setStorageSync` | 保存业务缓存和页面间临时状态 |
| `wx.removeStorageSync` | 消费并删除页面间临时状态 |
| `wx.chooseMedia` | 从相册或相机选择单张衣物/愿望图片 |
| `wx.chooseMessageFile` | 从微信会话选择 JSON 备份文件 |
| `wx.saveFile` | 把临时图片保存为持久文件 |
| `wx.getSavedFileList` | 删除图片前确认文件属于持久文件列表 |
| `wx.removeSavedFile` | 删除不再使用的持久图片 |
| `wx.getFileSystemManager` | 读取备份图片、写入恢复图片及生成 JSON 备份文件 |
| `wx.env.USER_DATA_PATH` | 定位小程序用户文件目录 |
| `wx.saveImageToPhotosAlbum` | 将衣橱和愿望图片逐张保存到系统相册 |
| `wx.showShareImageMenu` | 在支持的真机环境中打开图片分享菜单 |
| `wx.shareFileMessage` | 分享已生成的完整 JSON 备份文件 |
| `wx.saveFileToDisk` | 在支持的桌面微信环境中把备份保存到电脑 |
| `wx.navigateTo` | 进入非 Tab 页面 |
| `wx.navigateBack` | 从表单页返回 |
| `wx.switchTab` | 进入衣橱或添加等 Tab 页面 |
| `wx.setNavigationBarTitle` | 根据新增、编辑等页面状态更新标题 |
| `wx.showToast` | 显示成功、校验失败和操作反馈 |
| `wx.showModal` | 删除、批量操作和导入前确认 |
| `wx.showLoading` / `wx.hideLoading` | 为图片备份、恢复和批量保存显示进度 |
| `wx.setClipboardData` | 把 JSON 备份复制到剪贴板 |
| `wx.getDeviceInfo` / `wx.getSystemInfoSync` | 判断开发者工具、桌面端和真机能力差异 |

项目没有对这些平台 API 进行适配器封装。单元测试或非微信环境运行时，需要提供包含相应方法的全局 `wx` mock，以及 `App`/`Page` mock。

## 20. 已知契约边界

- 所有数据仅存在于当前设备的微信本地缓存和持久文件目录，没有跨设备同步。
- 写接口不是事务操作。涉及多个存储键的级联更新中途失败时，没有自动回滚。
- 本地存储容量、文件生命周期和 API 兼容性由微信运行时决定。
- `validateBackup()` 会验证备份结构和图片引用，但不会校验所有业务字段的语义；仍不应导入不可信来源的 JSON。
- ID 使用时间戳和随机字符串生成，适合本地应用，但不是跨设备或高并发系统的全局唯一性保证。
