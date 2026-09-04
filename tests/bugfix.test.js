// 缺陷修复回归测试：add 页编辑会话复位 / 保存异常恢复 / outfit-form 重复衣物拦截
// 运行: node tests/bugfix.test.js
// 说明: 页面级测试沿用 fr-001 的 Page mock 模式（无 npm 依赖）

const assert = require('assert')

const store = new Map()
const toastMessages = []

global.wx = {
  env: { USER_DATA_PATH: 'wxfile://usr' },
  getDeviceInfo() { return { platform: '' } },
  getStorageSync(key) { return store.get(key) },
  setStorageSync(key, value) { store.set(key, value) },
  removeStorageSync(key) { store.delete(key) },
  saveFile(options) { options.success({ savedFilePath: `saved://${options.tempFilePath}` }) },
  getSavedFileList(options) { options.success({ fileList: [] }) },
  removeSavedFile(options) {},
  getFileSystemManager() {
    return {
      unlink(options) { if (options.success) options.success() },
      readdir(options) { if (options.fail) options.fail({ errMsg: 'readdir:fail' }) },
      rmdir(options) { if (options.fail) options.fail({ errMsg: 'rmdir:fail' }) }
    }
  },
  showToast(options) { toastMessages.push(options.title) },
  showModal() {},
  showLoading() {},
  hideLoading() {},
  switchTab() {},
  navigateBack() {}
}

// app 实例 mock：add 页用它区分“切走 tab”与“程序退后台”
const appGlobalData = {}
global.getApp = () => ({ globalData: appGlobalData })

const wardrobe = require('../utils/wardrobe')

function resetStorage() {
  store.clear()
  toastMessages.length = 0
  store.set('privateWardrobeCategoriesManaged', true)
  store.set('privateWardrobeCustomCategories', ['上衣', '下装', '其他'])
  store.set('privateWardrobeOccasionsManaged', true)
  store.set('privateWardrobeCustomOccasions', ['通勤', '旅行'])
}

function loadPageConfig(path) {
  let config = null
  global.Page = (pageConfig) => { config = pageConfig }
  delete require.cache[require.resolve(path)]
  require(path)
  return config
}

function buildPage(config) {
  return {
    ...config,
    data: JSON.parse(JSON.stringify(config.data)),
    setData(updates) {
      Object.entries(updates).forEach(([path, value]) => {
        if (!path.includes('.') && !path.includes('[')) {
          this.data[path] = value
          return
        }
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
        let target = this.data
        parts.slice(0, -1).forEach((part) => { target = target[part] })
        target[parts[parts.length - 1]] = value
      })
    }
  }
}

function validItemForm() {
  return {
    id: 'i1',
    imageUrl: '',
    name: '白衬衫',
    category: '上衣',
    price: '159.5',
    color: '白色',
    seasons: ['春'],
    occasions: ['通勤'],
    purchaseDate: '2026-07-13',
    status: '常穿',
    note: '优衣库'
  }
}

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`${name}: OK`)
  } catch (error) {
    failed += 1
    console.log(`${name}: FAIL => ${error.message}`)
  }
}

// ============ add 页：编辑会话复位（B3） ============
const addConfig = loadPageConfig('../pages/add/add')

test('add 页: 切走 tab 再回来，遗留的编辑会话被复位', () => {
  resetStorage()
  appGlobalData.backgroundedAt = Date.now() - 60000 // 很久之前退过后台
  const page = buildPage(addConfig)
  page.hasVisited = true
  page.setData({ isEditing: true, form: validItemForm() })
  page.onHide() // 模拟切走 tab
  page.onShow()
  assert.strictEqual(page.data.isEditing, false)
  assert.strictEqual(page.data.form.name, '')
  assert.ok(toastMessages.some((message) => message.includes('已退出编辑')))
})

test('add 页: 程序退后台后返回，编辑内容保留', () => {
  resetStorage()
  const page = buildPage(addConfig)
  page.hasVisited = true
  page.setData({ isEditing: true, form: validItemForm() })
  page.onHide() // 页面与 App.onHide 几乎同时触发 = 程序退后台
  appGlobalData.backgroundedAt = Date.now()
  page.onShow()
  assert.strictEqual(page.data.isEditing, true)
  assert.strictEqual(page.data.form.name, '白衬衫')
})

test('add 页: 全新表单不误报“退出编辑”', () => {
  resetStorage()
  const page = buildPage(addConfig)
  page.hasVisited = true
  page.onHide()
  page.onShow()
  assert.strictEqual(page.data.isEditing, false)
  assert.ok(!toastMessages.some((message) => message.includes('已退出编辑')))
})

test('add 页: 保存时存储写入异常，isSaving 复位且不跳转', () => {
  resetStorage()
  const page = buildPage(addConfig)
  page.setData({ isEditing: false, form: { ...validItemForm(), id: '' } })
  const originalUpsert = wardrobe.upsertItem
  wardrobe.upsertItem = () => { throw new Error('setStorageSync:fail exceed storage max size') }
  try {
    page.saveItem({ currentTarget: { dataset: {} } })
  } finally {
    wardrobe.upsertItem = originalUpsert
  }
  assert.strictEqual(page.data.isSaving, false, 'isSaving 必须复位，否则保存按钮永久失效')
  assert.ok(toastMessages.some((message) => message.includes('保存失败')))
})

test('add 页: 畸形遗留数据（name 为对象）保存不再崩溃', () => {
  resetStorage()
  const page = buildPage(addConfig)
  page.setData({ isEditing: false, form: { ...validItemForm(), id: '', name: { hack: 1 } } })
  page.validateForm()
  assert.strictEqual(page.data.errors.name, '请填写衣物名字', '对象类型的 name 按未填写处理，给出明确提示')
  page.saveItem({ currentTarget: { dataset: {} } })
  assert.strictEqual(page.data.isSaving, false)
  assert.ok(toastMessages.some((message) => message.includes('请检查必填信息')))
  assert.ok(!toastMessages.some((message) => message.includes('保存失败')), '校验阶段拦截，不应走到存储写入')
})

// ============ outfit-form：重复衣物拦截（B5） ============
const outfitFormConfig = loadPageConfig('../pages/outfit-form/outfit-form')

function buildOutfitPage() {
  resetStorage()
  const page = buildPage(outfitFormConfig)
  page.setData({
    pieces: [
      { categoryName: '上衣', itemId: 'i1', displayName: '白T', itemIndex: 1, itemOptions: [{ id: '', name: '选择衣物' }, { id: 'i1', name: '白T' }] },
      { categoryName: '下装', itemId: '', displayName: '选择衣物', itemIndex: 0, itemOptions: [{ id: '', name: '选择衣物' }, { id: 'i2', name: '牛仔裤' }] }
    ],
    showItemPanel: true,
    editingItemPieceIndex: 1
  })
  return page
}

test('outfit-form: 选择已在穿搭中的衣物被拦截并提示', () => {
  const page = buildOutfitPage()
  page.selectItem({ currentTarget: { dataset: { id: 'i1', name: '白T' } } })
  assert.strictEqual(page.data.pieces[1].itemId, '', '重复衣物不应写入')
  assert.strictEqual(page.data.showItemPanel, true, '面板保持打开以便重选')
  assert.ok(toastMessages.some((message) => message.includes('已在穿搭中')))
})

test('outfit-form: 选择未重复的衣物正常写入', () => {
  const page = buildOutfitPage()
  page.selectItem({ currentTarget: { dataset: { id: 'i2', name: '牛仔裤' } } })
  assert.strictEqual(page.data.pieces[1].itemId, 'i2')
  assert.strictEqual(page.data.showItemPanel, false)
})

// ============ 本轮修复：归一化补齐（8 项） ============
test('归一化: 对象 imageUrl 删除不再崩溃', () => {
  resetStorage()
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: '鞋', category: '鞋子', imageUrl: { hack: 1 } }])
  const wardrobeLib = require('../utils/wardrobe')
  wardrobeLib.deleteWishlistItem('w1')
  assert.deepStrictEqual(wardrobeLib.getWishlist(), [])
})

test('归一化: 备份数字 id 转字符串，穿搭关联不断裂', () => {
  resetStorage()
  const wardrobeLib = require('../utils/wardrobe')
  const result = wardrobeLib.importData({
    version: 4,
    items: [{ id: 123, name: 'T', category: '上衣' }],
    outfits: [{ id: 'o1', name: 'OOTD', pieces: [{ category: '上衣', itemId: '123' }] }],
    wishlist: []
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(wardrobeLib.getOutfits()[0].pieces.length, 1)
})

test('归一化: 非法价格归空串（布尔/数组/空白）', () => {
  resetStorage()
  const wardrobeLib = require('../utils/wardrobe')
  const result = wardrobeLib.validateBackup({
    version: 4,
    items: [
      { id: 'a', name: 'A', price: true },
      { id: 'b', name: 'B', price: [] },
      { id: 'c', name: 'C', price: ' ' }
    ],
    outfits: [],
    wishlist: []
  })
  assert.strictEqual(result.ok, true)
  result.backup.items.forEach((item) => assert.strictEqual(item.price, ''))
  const legal = wardrobeLib.validateBackup({
    version: 4,
    items: [{ id: 'p1', name: 'A', price: 159.5 }, { id: 'p2', name: 'B', price: 0 }],
    outfits: [],
    wishlist: []
  })
  assert.strictEqual(legal.backup.items[0].price, 159.5)
  assert.strictEqual(legal.backup.items[1].price, 0)
})

test('归一化: 备份脏分类不再污染本地', () => {
  resetStorage()
  const wardrobeLib = require('../utils/wardrobe')
  const result = wardrobeLib.importData({
    version: 4, items: [], outfits: [], wishlist: [], categories: [{ hack: 1 }, 123]
  })
  assert.strictEqual(result.ok, true)
  assert.ok(!JSON.stringify(store.get('privateWardrobeCustomCategories')).includes('object Object'))
})

test('归一化: 穿搭 pieces 含 null 不再崩溃', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'T', category: '上衣' }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: 'OOTD', pieces: [null] }])
  const wardrobeLib = require('../utils/wardrobe')
  assert.deepStrictEqual(wardrobeLib.getOutfits()[0].pieces, [])
  wardrobeLib.upsertOutfit({ name: 'O', pieces: [null] })
})

test('归一化: 购买转入非法价格不再变 0', () => {
  resetStorage()
  store.set('privateWardrobeWishlist', [{ id: 'w1', name: '鞋', category: '鞋子', expectedPrice: 'abc' }])
  const wardrobeLib = require('../utils/wardrobe')
  const result = wardrobeLib.purchaseWishlistItem('w1')
  const item = wardrobeLib.getItems().find((entry) => entry.id === result.itemId)
  assert.strictEqual(item.price, '')
})

test('归一化: add 页对象分类被校验拦截', () => {
  resetStorage()
  const page = buildPage(addConfig)
  page.setData({ isEditing: false, form: { ...validItemForm(), id: '', category: { hack: 1 } } })
  assert.strictEqual(page.validateForm(), false)
  assert.strictEqual(page.data.errors.category, '请选择衣物种类')
})

test('归一化: outfit-form 脏名字打开不再崩溃', () => {
  resetStorage()
  store.set('privateWardrobeItems', [{ id: 'i1', name: 'T', category: '上衣' }])
  store.set('privateWardrobeOutfits', [{ id: 'o1', name: { hack: 1 }, note: { x: 1 }, pieces: [{ category: '上衣', itemId: 'i1' }] }])
  const page = buildPage(outfitFormConfig)
  page.loadOutfitForEdit('o1', true)
  assert.strictEqual(page.data.form.name, '')
  assert.strictEqual(page.data.form.note, '')
})

console.log('')
console.log(`bugfix 测试: 通过 ${passed} / 失败 ${failed}`)
process.exitCode = failed ? 1 : 0
