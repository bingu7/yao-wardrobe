// FR-001 新增衣物 — 单元测试
// 覆盖 docs/FR-001-add-clothing-item/contract.md：Data-01 / Form-01 / Form-02 / Form-03 / Image-01 / Edit-01
// 沿用项目既有测试模式：Node 内置 assert + 全局 wx mock（与 tests/wardrobe.test.js 同构），无 npm 依赖
// 运行：node tests/fr-001-add-item.test.js

const assert = require('assert')

const store = new Map()
const removedFiles = []
const removedStorageKeys = []
const toastMessages = []
const switchTabCalls = []
const fileContents = new Map()
let saveFileShouldFail = false
let mediaPath = 'temp-new'

global.wx = {
  env: {
    USER_DATA_PATH: 'wxfile://usr'
  },
  getDeviceInfo() {
    return { platform: '' }
  },
  getStorageSync(key) {
    return store.get(key)
  },
  setStorageSync(key, value) {
    store.set(key, value)
  },
  removeStorageSync(key) {
    store.delete(key)
    removedStorageKeys.push(key)
  },
  saveFile(options) {
    if (saveFileShouldFail) {
      options.fail({ errMsg: 'saveFile:fail' })
      return
    }
    options.success({ savedFilePath: `saved://${options.tempFilePath}` })
  },
  getSavedFileList(options) {
    options.success({
      fileList: [
        { filePath: 'saved://old' },
        { filePath: 'saved://temp-new' }
      ]
    })
  },
  removeSavedFile(options) {
    removedFiles.push(options.filePath)
  },
  getFileSystemManager() {
    return {
      unlink(options) {
        if (options.success) options.success()
      }
    }
  },
  chooseMedia(options) {
    options.success({ tempFiles: [{ tempFilePath: mediaPath }] })
  },
  showToast(options) {
    toastMessages.push(options.title)
  },
  showLoading() {},
  hideLoading() {},
  switchTab(options) {
    switchTabCalls.push(options.url)
  },
  navigateBack() {}
}

const wardrobe = require('../utils/wardrobe')

function resetStorage() {
  store.clear()
  removedFiles.length = 0
  removedStorageKeys.length = 0
  toastMessages.length = 0
  switchTabCalls.length = 0
  fileContents.clear()
  saveFileShouldFail = false
  mediaPath = 'temp-new'
  store.set('privateWardrobeCategoriesManaged', true)
  store.set('privateWardrobeCustomCategories', ['上衣', '下装', '其他'])
  store.set('privateWardrobeOccasionsManaged', true)
  store.set('privateWardrobeCustomOccasions', ['通勤', '旅行'])
}

function setItems(items) {
  store.set('privateWardrobeItems', items)
}

// 加载 add 页面配置，构建支持 'form.xxx' 点路径 setData 的页面实例
let addPage
global.Page = (config) => {
  addPage = config
}
delete require.cache[require.resolve('../pages/add/add')]
require('../pages/add/add')

function buildPage() {
  const page = {
    ...addPage,
    data: JSON.parse(JSON.stringify(addPage.data)),
    setData(updates) {
      Object.entries(updates).forEach(([path, value]) => {
        if (!path.includes('.')) {
          this.data[path] = value
          return
        }
        const parts = path.split('.')
        let target = this.data
        parts.slice(0, -1).forEach((part) => {
          target = target[part]
        })
        target[parts[parts.length - 1]] = value
      })
    }
  }
  return page
}

function validForm(overrides) {
  return {
    id: '',
    imageUrl: '',
    name: '白色衬衫',
    category: '上衣',
    price: '159.5',
    color: '白色',
    seasons: ['春', '秋'],
    occasions: ['通勤'],
    purchaseDate: '2026-07-13',
    status: '常穿',
    note: '优衣库',
    ...overrides
  }
}

async function run() {
  // ── Data-01 数据层新增写入（OC-01/OC-02/OC-04/OC-05） ──
  resetStorage()
  const id = wardrobe.upsertItem({
    name: '白色衬衫',
    category: '上衣',
    price: 159.5,
    color: '白色',
    seasons: ['春', '秋'],
    occasions: ['通勤'],
    purchaseDate: '2026-07-13',
    status: '常穿',
    note: '优衣库',
    imageUrl: 'saved://photo'
  })
  assert.ok(/^item_\d+_[a-z0-9]{6}$/.test(id), 'id 应为 item_ 前缀唯一格式')
  assert.strictEqual(wardrobe.getItems().length, 1, '新增后列表应恰好一条')
  assert.strictEqual(wardrobe.getItems()[0].id, id, '记录应写入数组首项')

  const saved = wardrobe.getItem(id)
  assert.strictEqual(saved.name, '白色衬衫')
  assert.strictEqual(saved.category, '上衣')
  assert.strictEqual(saved.price, 159.5)
  assert.strictEqual(saved.color, '白色')
  assert.deepStrictEqual(saved.seasons, ['春', '秋'])
  assert.deepStrictEqual(saved.occasions, ['通勤'])
  assert.strictEqual(saved.purchaseDate, '2026-07-13')
  assert.strictEqual(saved.status, '常穿')
  assert.strictEqual(saved.note, '优衣库')
  assert.strictEqual(saved.imageUrl, 'saved://photo')
  assert.strictEqual(saved.wearCount, 0, '新记录 wearCount 应为 0')
  assert.strictEqual(saved.lastWornDate, '', '新记录 lastWornDate 应为空串')
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(saved.createdAt), 'createdAt 应为 ISO 8601')
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(saved.updatedAt), 'updatedAt 应为 ISO 8601')

  // 唯一性：连续两次新增 id 不相等
  const secondId = wardrobe.upsertItem({ name: '牛仔外套', category: '外套' })
  assert.notStrictEqual(secondId, id, '两次新增 id 不应重复')

  // 未知 ID 返回 null
  assert.strictEqual(wardrobe.getItem('missing-id'), null)

  // 规范化：缺省数组字段规整为空数组
  resetStorage()
  const minimalId = wardrobe.upsertItem({ name: '极简衣物', category: '其他' })
  const minimal = wardrobe.getItem(minimalId)
  assert.deepStrictEqual(minimal.seasons, [])
  assert.deepStrictEqual(minimal.occasions, [])
  assert.strictEqual(minimal.wearCount, 0)
  assert.strictEqual(minimal.lastWornDate, '')

  // 更新路径：有 id 时更新同 ID 记录并刷新 updatedAt
  const before = wardrobe.getItem(minimalId).updatedAt
  wardrobe.upsertItem({ id: minimalId, name: '改名衣物' })
  const after = wardrobe.getItem(minimalId)
  assert.strictEqual(after.name, '改名衣物')
  assert.ok(after.updatedAt >= before, '更新后 updatedAt 不应早于原值')

  // OC-14 选项来源：分类与场合来自受管理列表
  resetStorage()
  assert.deepStrictEqual(wardrobe.getFormCategories(), ['上衣', '下装', '其他'])
  assert.deepStrictEqual(wardrobe.getOccasions(), ['通勤', '旅行'])

  // ── Form-01 表单校验（OC-06/OC-07/OC-08） ──
  resetStorage()
  let page = buildPage()
  page.data.form = validForm({ name: '', category: '' })
  assert.strictEqual(page.validateForm(), false, '空名称与空分类应校验失败')
  assert.strictEqual(page.data.errors.name, '请填写衣物名字')
  assert.strictEqual(page.data.errors.category, '请选择衣物种类')
  assert.strictEqual(page.data.errors.price, '')

  for (const price of ['-1', '1.234', 'abc']) {
    page = buildPage()
    page.data.form = validForm({ price })
    assert.strictEqual(page.validateForm(), false, `价格 ${price} 应校验失败`)
    assert.strictEqual(page.data.errors.price, '价格需为大于或等于 0 的数字，最多 2 位小数')
  }

  for (const price of ['', '0', '12', '12.34']) {
    page = buildPage()
    page.data.form = validForm({ price })
    assert.strictEqual(page.validateForm(), true, `价格 ${price || '(空)'} 应校验通过`)
    assert.strictEqual(page.data.errors.price, '')
  }

  page = buildPage()
  page.data.form = validForm()
  assert.strictEqual(page.validateForm(), true, '合法完整表单应校验通过')
  assert.deepStrictEqual(page.data.errors, { imageUrl: '', name: '', category: '', price: '' })

  // ── Form-02 保存流程（OC-01/OC-09/OC-10 + 防重） ──
  // 校验失败：不写入存储并提示
  resetStorage()
  page = buildPage()
  page.data.form = validForm({ name: '' })
  page.saveItem({ currentTarget: { dataset: {} } })
  assert.strictEqual(toastMessages[toastMessages.length - 1], '请检查必填信息')
  assert.strictEqual(wardrobe.getItems().length, 0, '校验失败不应写入存储')

  // 保存成功：写入、名称 trim、价格规范化、反馈与跳转
  resetStorage()
  page = buildPage()
  page.data.form = validForm({ name: '  白色衬衫  ', price: '159.5' })
  page.saveItem({ currentTarget: { dataset: {} } })
  assert.strictEqual(wardrobe.getItems().length, 1)
  const created = wardrobe.getItems()[0]
  assert.strictEqual(created.name, '白色衬衫', '名称应 trim 后写入')
  assert.strictEqual(created.price, 159.5, '价格应为数字并保留两位小数')
  assert.strictEqual(created.wearCount, 0)
  assert.strictEqual(created.lastWornDate, '')
  assert.strictEqual(toastMessages[toastMessages.length - 1], '已保存')
  assert.deepStrictEqual(switchTabCalls, ['/pages/wardrobe/wardrobe'], '保存成功应跳转衣橱首页')

  // 空价格保存为空串
  resetStorage()
  page = buildPage()
  page.data.form = validForm({ price: '' })
  page.saveItem({ currentTarget: { dataset: {} } })
  assert.strictEqual(wardrobe.getItems()[0].price, '', '空价格应保存为空串')

  // 保存并继续添加：留在表单页、表单重置、加载态复位
  resetStorage()
  page = buildPage()
  page.data.form = validForm({ name: '连录衣物' })
  page.saveItem({ currentTarget: { dataset: { continue: 'true' } } })
  assert.strictEqual(wardrobe.getItems()[0].name, '连录衣物')
  assert.deepStrictEqual(switchTabCalls, [], '继续添加不应跳转')
  assert.strictEqual(page.data.form.name, '', '继续添加后表单应重置')
  assert.strictEqual(page.data.isSaving, false)
  assert.strictEqual(page.data.isEditing, false)

  // isSaving 防重：保存中重复触发直接返回
  resetStorage()
  page = buildPage()
  page.data.form = validForm()
  page.data.isSaving = true
  page.saveItem({ currentTarget: { dataset: {} } })
  assert.strictEqual(wardrobe.getItems().length, 0, '保存中不应重复写入')
  assert.strictEqual(toastMessages.length, 0, '保存中不应重复提示')

  // ── Form-03 面板选择同步 ──
  resetStorage()
  page = buildPage()
  page.data.categories = ['全部', '上衣', '下装', '其他']
  page.selectCategoryFromPanel({ currentTarget: { dataset: { category: '下装' } } })
  assert.strictEqual(page.data.form.category, '下装')
  assert.strictEqual(page.data.errors.category, '')
  page.selectStatus({ currentTarget: { dataset: { status: '闲置' } } })
  assert.strictEqual(page.data.form.status, '闲置')
  page.selectQuickDate({ currentTarget: { dataset: { offset: 0 } } })
  assert.strictEqual(page.data.form.purchaseDate, wardrobe.formatLocalDate(new Date()))

  // ── Image-01 图片生命周期（OC-11/OC-12） ──
  // 选图成功：持久化路径写入表单
  resetStorage()
  page = buildPage()
  page.chooseImage()
  await Promise.resolve()
  assert.strictEqual(page.data.form.imageUrl, 'saved://temp-new')
  assert.strictEqual(page.pendingImageUrl, 'saved://temp-new')
  assert.deepStrictEqual(removedFiles, [])

  // 连续选图：旧 pending 图被清理
  mediaPath = 'temp-new2'
  page.chooseImage()
  await Promise.resolve()
  assert.strictEqual(page.data.form.imageUrl, 'saved://temp-new2')
  assert.ok(removedFiles.includes('saved://temp-new'), '连续选图应清理旧 pending 图')

  // 图片保存失败：提示且不写入表单
  resetStorage()
  saveFileShouldFail = true
  page = buildPage()
  page.chooseImage()
  // reject 路径经 .then 派生再进 .catch，需要两轮微任务
  await Promise.resolve()
  await Promise.resolve()
  assert.strictEqual(toastMessages[toastMessages.length - 1], '图片保存失败，请重试')
  assert.strictEqual(page.data.form.imageUrl, '')

  // ── Edit-01 编辑复用（OC-13/OC-12） ──
  // 编辑加载：读取并删除临时键，表单回填
  resetStorage()
  setItems([{
    id: 'item-a',
    name: '编辑衣物',
    category: '下装',
    price: '88',
    color: '黑',
    seasons: ['夏'],
    occasions: ['旅行'],
    purchaseDate: '2026-07-01',
    status: '偶尔穿',
    note: '备注',
    imageUrl: ''
  }])
  store.set('wardrobeEditingId', 'item-a')
  page = buildPage()
  page.onShow()
  assert.ok(removedStorageKeys.includes('wardrobeEditingId'), '编辑键应被消费删除')
  assert.strictEqual(page.data.isEditing, true)
  assert.strictEqual(page.data.form.name, '编辑衣物')
  assert.strictEqual(page.data.form.category, '下装')
  assert.deepStrictEqual(page.data.form.occasions, ['旅行'])

  // 编辑保存：更新同 ID 记录
  resetStorage()
  setItems([{ id: 'item-b', name: '旧名', category: '上衣' }])
  page = buildPage()
  page.data.isEditing = true
  page.data.form = validForm({ id: 'item-b', name: '新名字' })
  page.saveItem({ currentTarget: { dataset: {} } })
  assert.strictEqual(wardrobe.getItem('item-b').name, '新名字', '编辑保存应更新同 ID 记录')

  // 编辑替换图片：原图不再被引用时清理
  resetStorage()
  setItems([{
    id: 'image-item',
    name: '图片衣物',
    category: '上衣',
    imageUrl: 'saved://old',
    seasons: [],
    occasions: []
  }])
  page = buildPage()
  page.data.isEditing = true
  page.data.form = {
    id: 'image-item',
    imageUrl: 'saved://old',
    name: '图片衣物',
    category: '上衣',
    price: '',
    color: '',
    seasons: [],
    occasions: [],
    purchaseDate: '',
    status: '',
    note: ''
  }
  page.originalImageUrl = 'saved://old'
  page.chooseImage()
  await Promise.resolve()
  assert.strictEqual(page.data.form.imageUrl, 'saved://temp-new')
  assert.deepStrictEqual(removedFiles, [], '选图阶段不应删除原图')
  page.saveItem({ currentTarget: { dataset: {} } })
  assert.deepStrictEqual(removedFiles, ['saved://old'], '编辑保存替换图片应清理旧图')
  assert.strictEqual(wardrobe.getItem('image-item').imageUrl, 'saved://temp-new')

  console.log('fr-001 add-item tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
