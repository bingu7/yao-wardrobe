const assert = require('assert')

const store = new Map()
const removedFiles = []
let saveFileShouldFail = false

global.wx = {
  getStorageSync(key) {
    return store.get(key)
  },
  setStorageSync(key, value) {
    store.set(key, value)
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
  chooseMedia(options) {
    options.success({ tempFiles: [{ tempFilePath: 'temp-new' }] })
  },
  showToast() {},
  switchTab() {}
}

const wardrobe = require('../utils/wardrobe')

function resetStorage() {
  store.clear()
  removedFiles.length = 0
  saveFileShouldFail = false
  store.set('privateWardrobeCategoriesManaged', true)
  store.set('privateWardrobeCustomCategories', ['上衣', '下装', '其他'])
  store.set('privateWardrobeOccasionsManaged', true)
  store.set('privateWardrobeCustomOccasions', ['通勤', '旅行'])
}

function setItems(items) {
  store.set('privateWardrobeItems', items)
}

async function run() {
  resetStorage()
  assert.strictEqual(
    wardrobe.formatLocalDate(new Date(2026, 6, 10, 0, 30)),
    '2026-07-10'
  )

  setItems([{
    id: 'a',
    name: '上衣 A',
    category: '上衣',
    price: 100,
    wearCount: 0,
    occasions: ['通勤']
  }])
  const recordDate = new Date(2026, 6, 10, 0, 30)
  assert.strictEqual(wardrobe.markWorn('a', recordDate).ok, true)
  assert.strictEqual(wardrobe.markWorn('a', recordDate).ok, false)
  assert.strictEqual(wardrobe.getItem('a').wearCount, 1)
  assert.strictEqual(wardrobe.getItem('a').lastWornDate, '2026-07-10')

  const summary = wardrobe.summarize([
    { id: 'a', name: 'A', category: '上衣', price: 100, wearCount: 1 },
    { id: 'b', name: 'B', category: '下装', price: 100, wearCount: 9 }
  ])
  assert.strictEqual(summary.averageCostPerWear, 20)

  resetStorage()
  setItems([
    { id: 'a', name: 'A', category: '上衣', occasions: ['通勤'] },
    { id: 'b', name: 'B', category: '下装', occasions: [] }
  ])
  store.set('privateWardrobeOutfits', [
    {
      id: 'outfit-a',
      name: '两件套',
      occasion: '通勤',
      pieces: [
        { category: '上衣', itemId: 'a' },
        { category: '下装', itemId: 'b' }
      ]
    },
    {
      id: 'outfit-b',
      name: '单件',
      occasion: '旅行',
      pieces: [{ category: '上衣', itemId: 'a' }]
    }
  ])
  store.set('privateWardrobeWishlist', [
    { id: 'wish-a', name: '愿望', category: '上衣', matchItemId: 'a' }
  ])

  wardrobe.deleteItem('a')
  assert.deepStrictEqual(wardrobe.getOutfit('outfit-a').pieces, [
    { category: '下装', itemId: 'b' }
  ])
  assert.deepStrictEqual(wardrobe.getOutfit('outfit-b').pieces, [])
  assert.strictEqual(wardrobe.getWishlist()[0].matchItemId, '')

  wardrobe.deleteCustomOccasion('通勤')
  assert.deepStrictEqual(wardrobe.getItem('b').occasions, [])
  assert.strictEqual(wardrobe.getOutfit('outfit-a').occasion, '')

  const dedupedId = wardrobe.upsertOutfit({
    name: '去重测试',
    pieces: [
      { category: '下装', itemId: 'b' },
      { category: '下装', itemId: 'b' }
    ]
  })
  assert.strictEqual(wardrobe.getOutfit(dedupedId).pieces.length, 1)

  resetStorage()
  setItems([{ id: 'existing', name: '已有衣物', category: '上衣', price: 10 }])
  wardrobe.addWishlistItem({ name: '待购买', category: '鞋子', expectedPrice: 99, imageUrl: '', note: '' })
  const wishId = wardrobe.getWishlist()[0].id
  assert.strictEqual(wardrobe.purchaseWishlistItem(wishId).ok, true)
  assert.strictEqual(wardrobe.getWishlist().length, 0)
  assert.strictEqual(wardrobe.getItems()[0].name, '待购买')

  const backup = wardrobe.exportData()
  store.clear()
  assert.strictEqual(wardrobe.importData(backup).ok, true)
  assert.strictEqual(wardrobe.getItems()[0].name, '待购买')

  resetStorage()
  setItems([{ id: 'local-only', name: '本地衣物', category: '上衣', imageUrl: 'saved://local' }])
  assert.strictEqual(wardrobe.importData({
    items: [{ id: 'remote-only', name: '备份衣物', category: '下装', imageUrl: '' }],
    outfits: [],
    wishlist: []
  }).ok, true)
  assert.strictEqual(wardrobe.getItems().length, 2)
  assert.strictEqual(wardrobe.getItem('local-only').imageUrl, 'saved://local')

  resetStorage()
  setItems([{ id: 'b', name: 'B', category: '下装' }])
  store.set('privateWardrobeOutfits', [{
    id: 'legacy',
    name: '旧穿搭',
    pieces: [{ category: '上衣', itemId: 'missing' }]
  }])
  store.set('privateWardrobeWishlist', [{
    id: 'legacy-wish',
    name: '旧愿望',
    matchItemId: 'missing'
  }])
  assert.deepStrictEqual(wardrobe.getOutfit('legacy').pieces, [])
  assert.strictEqual(wardrobe.getWishlist()[0].matchItemId, '')

  saveFileShouldFail = true
  await assert.rejects(() => wardrobe.persistImage('temp-file'))

  let addPage
  global.Page = (config) => {
    addPage = config
  }
  delete require.cache[require.resolve('../pages/add/add')]
  require('../pages/add/add')

  resetStorage()
  setItems([{
    id: 'image-item',
    name: '图片衣物',
    category: '上衣',
    imageUrl: 'saved://old',
    seasons: [],
    occasions: []
  }])
  const page = {
    ...addPage,
    data: JSON.parse(JSON.stringify(addPage.data)),
    originalImageUrl: 'saved://old',
    pendingImageUrl: '',
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
  saveFileShouldFail = false
  page.chooseImage()
  await Promise.resolve()
  assert.strictEqual(page.data.form.imageUrl, 'saved://temp-new')
  assert.deepStrictEqual(removedFiles, [])

  page.saveItem({ currentTarget: { dataset: {} } })
  assert.deepStrictEqual(removedFiles, ['saved://old'])

  console.log('wardrobe tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
