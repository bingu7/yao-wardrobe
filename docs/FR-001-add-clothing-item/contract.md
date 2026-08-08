# FR-001 新增衣物 — 操作契约（CONTRACT）

> 本契约供 `implement-feature` 满足、`evaluator` 校验与 `unit-test-writer` 覆盖。所有 gate/criterion 的 `id` 即 evaluator 在 `evaluation-report.json` 中引用的 `ref` 值。

## 1. 环境契约（Environment Contract）

| 项 | 要求 | 说明 |
| --- | --- | --- |
| Node.js 运行时 | 可用 `node` 命令（版本不限，项目零依赖） | 所有自动化测试通过 `node tests/*.test.js` 执行 |
| npm 依赖 | 无（项目不使用 npm，禁止新增依赖） | 原生小程序，Node 内置 `assert` |
| 微信小程序运行时 | `libVersion 3.8.0+`（`project.config.json`） | 人工验证页面交互所需；自动化验证使用 `tests/_mock.js` 的全局 `wx` mock |
| wx mock | `tests/_mock.js` 提供 `wx`（存储/文件系统/媒体/Toast/导航） | 单元测试的运行前提 |
| 外部服务 | 无 | 纯本地应用，无服务器、无网络请求 |

环境不满足（如 `node` 不可用）时评估不启动（environment-invalid ≠ implementation-wrong）。

## 2. 质量门（Quality Gates）

| id | 命令 | 预期 | 说明 |
| --- | --- | --- | --- |
| `tests-fr001` | `node tests/fr-001-add-item.test.js` | 全部通过 | **待创建**（unit-test-writer 产出）。文件不存在时该门标记为环境未满足，不判实现错误 |
| `tests-core` | `node tests/wardrobe.test.js` | 全部通过 | 主回归，含 add 页面保存路径 |
| `tests-regression` | `node tests/regression.test.js` | 133/138 通过 | 5 个失败为 PRD §7 已确认缺陷（B1–B5）的 BUG-CHECK 用例，验收排除，不得视为实现错误 |
| `tests-e2e-newuser` | `node tests/e2e-1-new-user.test.js` | 全部通过 | 新用户端到端流程（含新增衣物） |

**契约假设（G1）：** 项目无 lint/typecheck/build/架构检查基础设施（原生小程序），故不声明此类门；门只使用真实可发现的测试命令。

## 3. 覆盖清单（Coverage Manifest）

| 预期行为 | 覆盖表面 | 表面 ID |
| --- | --- | --- |
| 新增记录写入数据层并规范化 | wardrobe.js 数据层单测 | `Data-01` |
| 表单校验规则（名称/分类/价格） | add 页 `validateForm` 单测 | `Form-01` |
| 保存流程（写入/反馈/跳转/连录/防重） | add 页 `saveItem` 单测 | `Form-02` |
| 分类/场合选项与面板选择同步 | add 页选项与面板单测 | `Form-03` |
| 图片选择、持久化与清理 | 图片生命周期单测 | `Image-01` |
| 编辑复用与旧图替换清理 | 编辑加载/保存单测 | `Edit-01` |

## 4. 表面与行为（Surfaces & Behaviors）

### `Data-01` 数据层新增写入（`utils/wardrobe.js`）
- **初始状态：** 存储 `privateWardrobeItems` 为空数组（`getItems()` 首次调用写入空数组）
- **可观测行为：**
  - `upsertItem(无id)` 返回以 `item_` 开头的唯一 ID，记录写入数组**首项**
  - 记录含 `createdAt`/`updatedAt`（ISO 8601）、`wearCount=0`、`lastWornDate=''`、`occasions`/`seasons` 为数组
  - `getItem(id)` 返回规范化后的记录；未知 ID 返回 `null`

### `Form-01` 表单校验（`pages/add/add.js` `validateForm`）
- **初始状态：** 空表单（`emptyForm`），errors 全空
- **可观测行为：**
  - 名称空白 → `false`，`errors.name='请填写衣物名字'`
  - 分类未选 → `false`，`errors.category='请选择衣物种类'`
  - 价格非法（非 `^\d+(\.\d{1,2})?$` 或负数）→ `false`，`errors.price='价格需为大于或等于 0 的数字，最多 2 位小数'`
  - 合法表单 → `true`，errors 为空

### `Form-02` 保存流程（`pages/add/add.js` `saveItem`）
- **初始状态：** `isSaving=false`、表单可编辑
- **可观测行为：**
  - 校验失败 → `wx.showToast('请检查必填信息')`，存储无写入
  - 校验通过 → 写入存储；成功 `wx.showToast('已保存')`；默认 `wx.switchTab` 至 `/pages/wardrobe/wardrobe`
  - `data-continue=true` 且非编辑 → 不跳转，表单重置为空，`isSaving=false`
  - `isSaving=true` 时重复触发直接返回（防重）

### `Form-03` 选项与面板（`pages/add/add.js`）
- **初始状态：** 分类/场合来自 `wardrobe.getFormCategories()` / `getOccasions()`
- **可观测行为：** 分类面板选中后 `form.category` 同步且清除错误；状态面板选中后 `form.status` 同步；日期快捷选择/清空后 `form.purchaseDate` 同步

### `Image-01` 图片生命周期
- **初始状态：** `form.imageUrl=''`、`pendingImageUrl=''`
- **可观测行为：**
  - `chooseImage` 成功 → `form.imageUrl` = `persistImage` 返回的持久路径；连续选图时旧 pending 图被 `removeImageFile`
  - 图片保存失败 → `wx.showToast('图片保存失败，请重试')`，表单可继续
  - 保存后不再被引用的旧图经 `removeImageFileIfUnused` 清理

### `Edit-01` 编辑复用（与 FR-002 共享实现）
- **初始状态：** 存储含 `wardrobeEditingId`（或为空）
- **可观测行为：** `onShow` 读取到编辑键 → `wx.removeStorageSync('wardrobeEditingId')` 删除、表单回填目标衣物字段、`isEditing=true`、`originalImageUrl` 记录原图；编辑保存且原图被替换 → 原图经 `removeImageFileIfUnused` 清理

## 5. 可观测标准（Observable Criteria）

| id | 验收标准（证据化） | 来源 |
| --- | --- | --- |
| `OC-01` | 新增保存后 `wardrobe.getItems()[0].id === upsertItem 返回值`，且数组长度 +1（证据：数据层断言） | FR-001 保存 |
| `OC-02` | 保存后记录逐字段等于表单值：name/category/price/color/seasons/occasions/purchaseDate/status/note/imageUrl；`name` 为 trim 后结果（证据：`deepStrictEqual`） | FR-001 字段完整 |
| `OC-03` | 价格空串保存为 `''`；`'159.5'` 保存为 `159.5`（`Number(Number(v).toFixed(2))`，证据：`getItem(id).price`） | FR-001 价格 |
| `OC-04` | 新记录 `wearCount === 0`、`lastWornDate === ''`（证据：断言） | §5.1 数据模型 |
| `OC-05` | 新记录 `createdAt`/`updatedAt` 匹配 ISO 8601 正则；id 以 `item_` 开头；连续两次新增 id 不相等（证据：正则 + 不等断言） | §5.1 数据模型 |
| `OC-06` | 名称为空时 `validateForm` 返回 `false`、`errors.name` 非空、`saveItem` 不写存储、toast「请检查必填信息」（证据：errors + store 长度 + toastMessages） | FR-001 名称必填 |
| `OC-07` | 未选分类时 `validateForm` 返回 `false`、`errors.category` 非空、不写存储（证据：断言） | FR-001 分类必填 |
| `OC-08` | 价格 `'-1'`/`'1.234'`/`'abc'` 均校验失败且 `errors.price` 含规定文案；`''`/`'12'`/`'12.34'` 校验通过（证据：断言） | FR-001 价格规则 |
| `OC-09` | 保存成功 toast「已保存」，`wx.switchTab` 收到 url `/pages/wardrobe/wardrobe`（证据：mock 记录） | §4.1 流程 |
| `OC-10` | `data-continue=true` 且非编辑：不触发 switchTab、`form` 重置为空对象、`isSaving=false`（证据：mock 记录 + data 断言） | §4.1 连录 / FR-010 |
| `OC-11` | `chooseImage` 后 `form.imageUrl` 为 `persistImage` 返回的持久路径（mock 前缀 `saved://`）；再次选图时旧 pending 被 `removeImageFile`（证据：removedFiles 断言） | §4.1 选图 |
| `OC-12` | 编辑保存且新图 ≠ 原图时，原图路径出现在 `removeImageFileIfUnused` 清理记录中（证据：removedFiles 断言） | §5 图片生命周期 |
| `OC-13` | 存储含 `wardrobeEditingId` 时 `onShow` 删除该键并回填对应衣物字段（证据：removeStorageSync + data 断言） | §4.3 / FR-002 |
| `OC-14` | 表单选项枚举来自 `getFormCategories()`/`getOccasions()`，至少包含既有分类与场合（证据：断言选项数组） | §5.2 |

## 6. 可追溯性（FR-001 → OC）

| FR-001 需求面 | 可观测标准 |
| --- | --- |
| 填写名称 | `OC-02` `OC-06` |
| 选择分类 | `OC-02` `OC-07` |
| 填写价格 | `OC-02` `OC-03` `OC-08` |
| 颜色/季节/场合/购买日期/状态/备注 | `OC-02` `OC-14` |
| 选择图片后保存 | `OC-11` |
| 保存成功 | `OC-01` `OC-04` `OC-05` `OC-09` |
| 继续添加（§4.1） | `OC-10` |
| 编辑复用（FR-002 共享） | `OC-12` `OC-13` |
