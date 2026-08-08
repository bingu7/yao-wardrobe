# FR-001 新增衣物 — 技术规格（SPEC）

> 定位：契约化规格。FR-001 在代码库中已完整实现（PRD §1 声明全部功能来源于真实代码），本文档如实记录既有设计，作为后续维护、单元测试与验收的依据。

## 1. 概述与范围

**功能描述：** 用户在「添加衣物」表单页填写名称、分类、价格、颜色、季节、场合、购买日期、状态、备注，并可选选择图片，校验通过后保存，写入微信本地缓存；支持「保存并继续添加」连录。编辑已有衣物复用同一页面（FR-002，通过 `wardrobeEditingId` 临时键交接）。

**技术摘要：** 表单页 `pages/add/add`（JS + WXML + WXSS）收集字段并在页面层校验（`validateForm`），调用 `utils/wardrobe.js` 的 `upsertItem()` 写入存储键 `privateWardrobeItems`；图片经 `wx.chooseMedia` → `persistImage`（`wx.saveFile`）转为持久文件路径；保存成功后 `wx.switchTab` 返回衣橱首页。

**Included（本特性范围）：**
- 新增衣物完整表单：名称、分类、价格、颜色、季节（多选）、场合（多选）、购买日期、状态、备注、图片
- 页面层校验契约：名称/分类必填、价格非负且最多 2 位小数（与 FR-006 共享实现，本特性记录契约，FR-006 单独验收）
- 图片选择与持久化（与 FR-005 共享实现，本特性记录新增路径）
- 保存流程：成功反馈、跳转衣橱首页、「保存并继续添加」连录
- 编辑复用能力记录（与 FR-002 共享页面；编辑数据流在本 spec 记录，验收以 FR-001 新增路径为主）
- 集成自交叉关注点：
  - 本地存储：数据全部 `wx.setStorageSync` 同步写入，无网络请求（§1.2 架构边界）
  - 可测试性：业务逻辑集中在 `utils/wardrobe.js`，页面只做视图与事件（§6.5）

**Deferred（不属本特性范围）：**
- 表单校验逻辑下沉到 `wardrobe.js` 为纯函数（留待 FR-006 处理）
- 关键词搜索/分类筛选/批量管理（FR-007/008/009）
- 表单 UI 重构、无障碍增强等其他增强项

**相关特性边界：** FR-002（编辑）、FR-005（图片持久化与清理）、FR-006（表单校验）、FR-010（继续添加）与本特性共享同一页面与数据层实现；本文档记录这些共享实现，但各 FR 的最终验收按其自身需求与 contract 执行。

## 2. 组件总览

| 组件 | 路径 | 职责 |
| --- | --- | --- |
| 添加页逻辑 | `pages/add/add.js`（719 行） | 表单状态、字段输入、校验（`validateForm`）、保存（`saveItem`）、面板交互、图片选择、编辑加载 |
| 添加页结构 | `pages/add/add.wxml` | 表单字段、分类/场合/状态/日期面板、图片上传区、按钮栈 |
| 添加页样式 | `pages/add/add.wxss` | 表单、chip、面板样式（沿用项目 compact 风格） |
| 数据层 | `utils/wardrobe.js` | `upsertItem` / `getItem` / `getItems` / `normalizeItem` / `createUniqueId` / `persistImage` / `removeImageFile` / `removeImageFileIfUnused` / `getFormCategories` / `getOccasions` / 常量 `seasons`、`statuses`、`formatLocalDate` |
| 入口页 | `pages/wardrobe/wardrobe.js` | 衣橱首页「＋ 添加」入口（`goAdd` → `wx.switchTab`） |
| 页面注册 | `app.json` | `pages/add/add` 注册为 Tab 页 |
| 单元测试（计划新增） | `tests/fr-001-add-item.test.js` | 覆盖数据层 + 页面层契约（由 unit-test-writer 流程生成） |
| 测试基础 | `tests/_mock.js` | 共享 wx mock（存储、文件系统、媒体选择、Toast） |
| 既有测试 | `tests/wardrobe.test.js` / `tests/regression.test.js` | 数据层回归，含 add 页面保存路径断言 |

## 3. 数据模型

### 3.1 WardrobeItem（存储键 `privateWardrobeItems`，数组）

| 字段 | 类型 | 说明 | 新增来源 |
| --- | --- | --- | --- |
| `id` | `string` | 唯一 ID，`item_时间戳_随机串`（`createUniqueId`） | 自动生成 |
| `imageUrl` | `string` | 持久图片路径，可为空 | 图片选择（`persistImage` 结果）或编辑保留 |
| `name` | `string` | 名称，保存时 `trim()`，必填 | 表单 |
| `category` | `string` | 分类，必填，来自 `getFormCategories()` | 分类面板 |
| `price` | `number \| ''` | 价格；空串表示未填写；非空保存为 `Number(Number(v).toFixed(2))` | 表单 |
| `color` | `string` | 颜色 | 表单 |
| `seasons` | `string[]` | 季节多选（春/夏/秋/冬） | 季节 chips |
| `occasions` | `string[]` | 场合多选 | 场合 chips |
| `purchaseDate` | `string` | `YYYY-MM-DD` | 日期面板/快捷日期 |
| `status` | `string` | 常穿/偶尔穿/闲置 | 状态面板 |
| `wearCount` | `number` | 穿着次数，初始 `0` | 自动（由穿着日志维护） |
| `lastWornDate` | `string` | 最近穿着日期，初始 `''` | 自动 |
| `note` | `string` | 备注 | 表单 |
| `createdAt` / `updatedAt` | `string` | ISO 8601 UTC 时间戳 | 自动（`new Date().toISOString()`） |

### 3.2 规范化规则（`normalizeItem`）

- `occasions` / `seasons` 非数组时规整为空数组
- `wearCount` 规整为数字（`Number(x) || 0`）
- `lastWornDate` 缺省为空串
- `upsertItem` 保存前对所有记录执行 `normalizeItem`，保证读取方（列表、详情、统计）字段类型稳定

### 3.3 临时交接键

- `wardrobeEditingId`：`pages/wardrobe/wardrobe.js` 详情页写入，`add.js onShow` 读取后立即 `wx.removeStorageSync` 删除，再 `loadItem(id)` 回填表单（编辑模式）

### 3.4 图片生命周期（新增路径）

```
wx.chooseMedia（count=1, album+camera）
  → tempFilePath → wardrobe.persistImage(tempFilePath)（wx.saveFile）
  → savedFilePath 存入 form.imageUrl
  → 再次选图：若存在上一 pendingImageUrl 且不同，先 removeImageFile(旧 pending)
  → 移除图片按钮：若当前图 == pendingImageUrl，removeImageFile 并清空
  → 编辑保存：原图 originalImageUrl ≠ 新图时 removeImageFileIfUnused(原图)
  → 页面卸载/离开：cleanupPendingImage() 清理未保存的 pending 图
```

## 4. API 契约

### 4.1 `upsertItem(item) → string`（数据层核心）

- 无 `id`：生成 `item_时间戳_随机串`，`createdAt`/`updatedAt` 设为当前 ISO 8601，插入数组**首项**，返回新 ID
- 有 `id` 且存在：合并字段并更新 `updatedAt`，返回该 ID
- 有 `id` 但不存在：按传入 ID 补建记录（供导入/迁移复用）
- 保存前执行 `normalizeItem`；保存后调用 `getOutfits()` 触发穿搭引用重算（不改变返回 ID）

```js
// 新增示例
const id = wardrobe.upsertItem({
  name: '白色衬衫',
  category: '上衣',
  price: 159.5,
  imageUrl: 'wxfile://usr/.../xxx.jpg',
  color: '白色',
  seasons: ['春', '秋'],
  occasions: ['通勤'],
  purchaseDate: '2026-07-13',
  status: '常穿',
  note: '优衣库'
})
// 存储结果（首项）：
// { id: 'item_1789..._ab12cd', name: '白色衬衫', category: '上衣', price: 159.5, ...,
//   wearCount: 0, lastWornDate: '', createdAt: '2026-08-08T08:00:00.000Z', updatedAt: '2026-08-08T08:00:00.000Z' }
```

### 4.2 相关数据层接口

| 接口 | 契约 |
| --- | --- |
| `getItems()` | 返回衣物数组；缓存非数组时写入空数组 |
| `getItem(id)` | 查找并 `normalizeItem`；不存在返回 `null` |
| `getFormCategories()` / `getCustomCategories()` | 表单分类选项（含自定义分类；首次合并默认值并回写） |
| `getOccasions()` | 场合选项（含自定义；首次合并默认值、旧缓存与衣物已有场合） |
| `persistImage(tempFilePath)` | `Promise<string>`，`wx.saveFile` 成功解析 `savedFilePath`，失败拒绝 |
| `removeImageFile(filePath)` | 删除持久图片（USER_DATA_PATH 内 unlink，其他查 savedFileList 后 removeSavedFile） |
| `removeImageFileIfUnused(filePath)` | 仅当衣物+愿望均不再引用时删除；已发起删除返回 `true` |
| `clearItemImage(id, imageUrl?)` | 图片加载失败时清空记录 `imageUrl` 并清理失效文件 |
| `formatLocalDate(date)` | 本地时区 `YYYY-MM-DD` |
| 常量 `seasons` / `statuses` | 季节与状态选项来源 |

### 4.3 页面层契约（`pages/add/add.js`）

**`validateForm()` → `boolean`**

| 规则 | 通过条件 | 失败提示（写入 `errors`） |
| --- | --- | --- |
| 名称必填 | `form.name.trim()` 非空 | `请填写衣物名字` |
| 分类必填 | `form.category` 非空 | `请选择衣物种类` |
| 价格格式 | 空串 或 `/^\d+(\.\d{1,2})?$/` 且 `Number ≥ 0` | `价格需为大于或等于 0 的数字，最多 2 位小数` |

**`saveItem(event)`**

- `isSaving` 为真时直接返回（防重复提交）
- `validateForm()` 失败 → `wx.showToast('请检查必填信息')`，不写入
- 通过 → `upsertItem({...form, name: trim, price: '' | Number(Number(v).toFixed(2))})`
- 编辑模式且原图被替换 → `removeImageFileIfUnused(originalImageUrl)`
- 成功 → `wx.showToast('已保存')`；`data-continue=true` 且非编辑 → 留在表单页并重置；否则 `wx.switchTab('/pages/wardrobe/wardrobe')`

### 4.4 微信平台 API 依赖

`wx.chooseMedia`、`wx.saveFile`、`wx.getSavedFileList`、`wx.removeSavedFile`、`wx.getFileSystemManager`、`wx.env.USER_DATA_PATH`、`wx.setStorageSync`、`wx.getStorageSync`、`wx.removeStorageSync`、`wx.showToast`、`wx.switchTab`、`wx.setNavigationBarTitle`。项目未做适配器封装，测试需提供全局 `wx` mock（`tests/_mock.js`）。

## 5. 前端实现（页面结构）

### 5.1 表单字段（`add.wxml`）

| 字段 | 控件 | 绑定/事件 | 长度限制 |
| --- | --- | --- | --- |
| 图片（可选） | 上传区 + image | `bindtap=chooseImage` / `binderror=onImageError` / `catchtap=removeImage` | — |
| 名字 * | input | `data-field=name` `bindinput=onInput` | maxlength 24 |
| 种类 * | 面板触发器 | `bindtap=openCategoryPanel` | 分类面板内输入 maxlength 10 |
| 价格 | input type=digit | `data-field=price` `bindinput=onInput` | — |
| 颜色 | input | `data-field=color` | maxlength 16 |
| 季节 | chip 多选 | `bindtap=toggleSeason` | 4 项固定 |
| 场合 | chip 多选（前 4 个 + 展开）+ 自定义添加 | `bindtap=toggleOccasion` / `toggleOccasionOptions` / `addCustomOccasion` | 自定义 maxlength 10 |
| 购买时间 | 面板 + picker + 快捷日期 | `openDatePanel` / `onDateChange` / `selectQuickDate`（今天/昨天/一周前/一月前/清空） | — |
| 状态 | 面板单选 | `openStatusPanel` / `selectStatus` | 3 项固定 |
| 备注 | textarea | `data-field=note` | — |

### 5.2 面板交互

- **分类面板**：网格选择；「编辑」模式支持重命名/上下移/删除（委托 `wardrobe.renameCustomCategory` / `moveCustomCategory` / `deleteCustomCategory`）；面板底部可新增分类（`addCustomCategory`），成功后自动选中新分类并清除错误态
- **场合面板**：列表重命名/上下移/删除 + 底部新增（`addCustomOccasion`），删除场合时同步移除表单已选值
- **状态面板**：`statuses` 单项选择，`statusIndex` 与表单同步
- **日期面板**：快捷日期（今天/昨天/一周前/一月前）+ `picker mode=date` + 清空

### 5.3 数据流

- `onShow`：刷新分类/场合 → 无 `isPickingImage` 且无编辑键且首次访问时重置表单（空表单、空错误、picker 归零）
- `onInput`：按 `data-field` 更新 `form[field]` 并清除该字段错误
- `validateForm` → `saveItem` → `upsertItem` → toast → 跳转或连录

### 5.4 编辑复用（与 FR-002 共享）

`onShow` 检测 `wardrobeEditingId` → `wx.removeStorageSync` 删除 → `loadItem(id)`：`cleanupPendingImage()`、记录 `originalImageUrl`、回填全部字段与 picker 索引、标题「编辑衣物」；保存走同一 `saveItem` 路径并处理原图替换清理。

## 6. 错误处理

| 场景 | 行为 |
| --- | --- |
| 校验失败（名称/分类/价格） | `errors` 内联提示 + `wx.showToast('请检查必填信息')`，不写入存储 |
| 图片保存失败（`persistImage` reject） | `wx.showToast('图片保存失败，请重试')`，`isPickingImage` 复位，不阻断表单其他字段 |
| 编辑目标不存在（`loadItem` 拿不到 `getItem(id)`） | `wx.showToast('衣物不存在')`，停留在表单页 |
| 图片加载失败（`onImageError`） | 当前图是 pending → 删除并清空；已有记录 → `clearItemImage(id, url)` 清空失效路径 |
| 连点保存 | `isSaving` 锁，重复触发直接返回 |

## 7. 测试策略

### 7.1 单元测试（新增 `tests/fr-001-add-item.test.js`）

沿用项目既有模式（Node 内置 `assert` + `tests/_mock.js` wx mock，无 npm 依赖），覆盖：

- **数据层**（`wardrobe` 模块）
  - `upsertItem` 新增：返回唯一 `item_` 前缀 ID；写入数组首项；`createdAt/updatedAt` 为 ISO 8601；`wearCount=0`、`lastWornDate=''`；`occasions/seasons` 规整为数组
  - `upsertItem` 价格：`''` 保留；`159.5` 保留两位小数
  - `upsertItem` 名称 trim：`' 白色衬衫 '` → `'白色衬衫'`
  - `getItem(id)` 读取新增记录；不存在返回 `null`
  - `getFormCategories()` / `getOccasions()` 提供选项
  - 图片生命周期：`persistImage` 成功返回持久路径；`removeImageFileIfUnused` 仍被引用时不删除、解除引用后删除
- **页面层**（`global.Page` mock 加载 `pages/add/add`）
  - `validateForm`：空名称/空分类/非法价格（`-1`、`1.234`、`abc`）→ false 且 errors 正确；合法表单 → true
  - `saveItem` 新增：写入存储并跳转（`wx.switchTab` 记录）；toast「已保存」
  - `saveItem` continue：`data-continue=true` 时表单重置、不跳转
  - `chooseImage` → `persistImage` 后 `form.imageUrl` 更新为持久路径；连续选图清理旧 pending
  - 编辑保存替换图片：`originalImageUrl` 被 `removeImageFileIfUnused`
  - `onShow` 编辑键交接：读取并删除 `wardrobeEditingId`、回填表单

### 7.2 既有回归

- `node tests/wardrobe.test.js`（主回归，含 add 页面保存路径）
- `node tests/regression.test.js`（138 用例全 API 覆盖；其中 5 个 BUG-CHECK 为 PRD §7 已确认缺陷，验收时排除）

### 7.3 验收映射（PRD → 测试）

| PRD 来源 | SPEC 落点 |
| --- | --- |
| FR-001 需求行（新增字段 + 图片 + 保存） | §1 范围、§4 API 契约、§7.1 |
| §4.1 添加衣物业务流程 | §5 前端实现、§7.1 saveItem 用例 |
| §5.1 WardrobeItem 数据模型 | §3 数据模型 |
| §6.1 性能（同步读写、防抖） | §4.4 依赖说明 |
| §6.5 可维护性/可测试性（逻辑集中 wardrobe.js、assert 测试） | §2 组件总览、§7 测试策略 |
| §7 已知缺陷（B1–B5） | 与本特性无关路径，不纳入 FR-001 验收 |

## 8. 决策与假设

| # | 决策/假设 | 依据 |
| --- | --- | --- |
| A1 | Spec 定位为「契约化规格」，记录既有实现 | 用户确认；PRD §1 声明功能来源于真实代码 |
| A2 | 验收标准从需求 + §4.1 + §5.1 + 代码行为推导（PRD 无 Section 9） | 用户确认 |
| A3 | 表单校验保持页面层 `add.js`，不下沉 wardrobe.js | 用户确认；FR-006 独立处理 |
| A4 | 特性名中文「新增衣物」经 kebab 化后为空，目录用 `FR-001-add-clothing-item` | spec-writer sanitize 规则适配 |
| A5 | 编辑复用、图片生命周期为共享实现，在本文档记录但验收以 FR-001 为主 | PRD 特性划分 |
| A6 | 无质量门基础设施（无 lint/typecheck/build）；门以测试命令为准 | 代码库现状（原生小程序） |
