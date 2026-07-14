const assert = require('assert')

const store = new Map()
const removedFiles = []
const fileContents = new Map()
const unlinkedFiles = []
const toastMessages = []
const modalMessages = []
let saveFileShouldFail = false
let mkdirShouldReportExisting = false
let writeFileCount = 0
let shareFileCount = 0
let saveToDiskCount = 0
let runtimePlatform = ''

global.wx = {
  env: {
    USER_DATA_PATH: 'wxfile://usr'
  },
  getDeviceInfo() {
    return { platform: runtimePlatform }
  },
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
  getFileSystemManager() {
    return {
      mkdir(options) {
        if (mkdirShouldReportExisting) {
          options.fail({
            errMsg: `mkdir:fail file already exists ${options.dirPath}`,
            errno: 1301005
          })
          return
        }
        options.success()
      },
      readFile(options) {
        if (!fileContents.has(options.filePath)) {
          options.fail({ errMsg: 'readFile:fail no such file' })
          return
        }
        options.success({ data: fileContents.get(options.filePath) })
      },
      writeFile(options) {
        writeFileCount += 1
        fileContents.set(options.filePath, options.data)
        options.success()
      },
      unlink(options) {
        fileContents.delete(options.filePath)
        unlinkedFiles.push(options.filePath)
        if (options.success) options.success()
      }
    }
  },
  chooseMedia(options) {
    options.success({ tempFiles: [{ tempFilePath: 'temp-new' }] })
  },
  showToast(options) {
    toastMessages.push(options.title)
  },
  showModal(options) {
    modalMessages.push(options)
  },
  showLoading() {},
  hideLoading() {},
  setClipboardData(options) {
    options.success()
  },
  shareFileMessage(options) {
    shareFileCount += 1
    if (options.success) options.success()
  },
  saveFileToDisk(options) {
    saveToDiskCount += 1
    if (options.success) options.success()
  },
  switchTab() {},
  navigateBack() {}
}

const wardrobe = require('../utils/wardrobe')

function resetStorage() {
  store.clear()
  removedFiles.length = 0
  unlinkedFiles.length = 0
  toastMessages.length = 0
  modalMessages.length = 0
  fileContents.clear()
  saveFileShouldFail = false
  mkdirShouldReportExisting = false
  writeFileCount = 0
  shareFileCount = 0
  saveToDiskCount = 0
  runtimePlatform = ''
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
  assert.strictEqual(wardrobe.markWorn('a', '2026-07-11').ok, true)
  assert.strictEqual(wardrobe.markWorn('a', '2026-02-30').ok, false)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  assert.strictEqual(wardrobe.markWorn('a', wardrobe.formatLocalDate(tomorrow)).ok, false)

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
  setItems([{
    id: 'same',
    name: '本地新数据',
    category: '上衣',
    updatedAt: '2026-07-12T00:00:00.000Z',
    wearCount: 1,
    lastWornDate: '2026-07-10'
  }])
  store.set('privateWardrobeWearLogs', { '2026-07-10': ['same'] })
  assert.strictEqual(wardrobe.importData({
    items: [{
      id: 'same',
      name: '备份旧数据',
      category: '下装',
      updatedAt: '2026-07-01T00:00:00.000Z',
      wearCount: 1,
      lastWornDate: '2026-07-11'
    }],
    outfits: [],
    wishlist: [],
    wearLogs: { '2026-07-11': ['same'] }
  }).ok, true)
  assert.strictEqual(wardrobe.getItem('same').name, '本地新数据')
  assert.strictEqual(wardrobe.getItem('same').wearCount, 2)
  assert.strictEqual(wardrobe.getItem('same').lastWornDate, '2026-07-11')

  resetStorage()
  setItems([{ id: 'category-item', name: '分类测试', category: '上衣' }])
  store.set('privateWardrobeOutfits', [{
    id: 'category-outfit',
    name: '分类穿搭',
    pieces: [{ category: '上衣', itemId: 'category-item' }]
  }])
  wardrobe.upsertItem({ id: 'category-item', category: '外套' })
  assert.strictEqual(wardrobe.getOutfit('category-outfit').pieces[0].category, '外套')
  wardrobe.upsertItem({ id: 'missing-id', name: '补建衣物', category: '其他' })
  assert.strictEqual(wardrobe.getItem('missing-id').name, '补建衣物')

  const recentDate = wardrobe.formatLocalDate(new Date())
  const oldDate = new Date()
  oldDate.setDate(oldDate.getDate() - 91)
  const idleSummary = wardrobe.summarize([
    { id: 'recent', name: '新衣物', purchaseDate: recentDate, wearCount: 0 },
    { id: 'old', name: '旧衣物', purchaseDate: wardrobe.formatLocalDate(oldDate), wearCount: 0 }
  ])
  assert.strictEqual(idleSummary.neverWornCount, 2)
  assert.strictEqual(idleSummary.idleOver90Count, 1)

  assert.strictEqual(wardrobe.validateBackup('{}').ok, false)

  resetStorage()
  fileContents.set('saved://photo.jpg', 'aW1hZ2UtYnl0ZXM=')
  setItems([{
    id: 'photo-item',
    name: '带图衣物',
    category: '上衣',
    imageUrl: 'saved://photo.jpg',
    updatedAt: '2026-07-12T00:00:00.000Z'
  }])
  store.set('privateWardrobeWishlist', [{
    id: 'photo-wish',
    name: '带图愿望',
    category: '鞋子',
    imageUrl: 'saved://photo.jpg',
    updatedAt: '2026-07-12T00:00:00.000Z'
  }])
  const imageBackup = await wardrobe.exportDataWithImages()
  assert.strictEqual(imageBackup.version, 4)
  assert.strictEqual(Object.keys(imageBackup.images).length, 1)
  assert.strictEqual(imageBackup.items[0].imageUrl, '')
  assert.strictEqual(imageBackup.items[0].imageRef, imageBackup.wishlist[0].imageRef)

  resetStorage()
  mkdirShouldReportExisting = true
  const imageImport = await wardrobe.importDataWithImages(imageBackup)
  assert.strictEqual(imageImport.ok, true)
  assert.strictEqual(imageImport.imageCount, 1)
  const restoredImage = wardrobe.getItem('photo-item').imageUrl
  assert.ok(restoredImage.startsWith('wxfile://usr/wardrobe-images/restore-'))
  assert.strictEqual(fileContents.get(restoredImage), 'aW1hZ2UtYnl0ZXM=')
  assert.strictEqual(wardrobe.getWishlistItem('photo-wish').imageUrl, restoredImage)
  const reExported = await wardrobe.exportDataWithImages()
  assert.strictEqual(reExported.images[reExported.items[0].imageRef].data, 'aW1hZ2UtYnl0ZXM=')
  const writesBeforeSameDeviceImport = writeFileCount
  const sameDeviceImport = await wardrobe.importDataWithImages(imageBackup)
  assert.strictEqual(sameDeviceImport.ok, true)
  assert.strictEqual(sameDeviceImport.imageCount, 0)
  assert.strictEqual(writeFileCount, writesBeforeSameDeviceImport)
  assert.strictEqual(wardrobe.getItem('photo-item').imageUrl, restoredImage)

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

  let settingsPage
  global.Page = (config) => {
    settingsPage = config
  }
  delete require.cache[require.resolve('../pages/settings/settings')]
  require('../pages/settings/settings')
  assert.doesNotThrow(() => settingsPage.restoreBackup('{}'))
  assert.strictEqual(toastMessages.pop(), '备份缺少必要数据')
  const settings = {
    ...settingsPage,
    data: { ...settingsPage.data },
    setData(updates) {
      Object.assign(this.data, updates)
    }
  }
  await settings.exportBackupFile()
  assert.strictEqual(settings.data.backupFileReady, true)
  assert.strictEqual(shareFileCount, 0)
  settings.sharePreparedBackupFile()
  assert.strictEqual(shareFileCount, 1)
  runtimePlatform = 'devtools'
  settings.onLoad()
  assert.strictEqual(settings.data.isDevtools, true)
  assert.strictEqual(settings.data.canSaveToDisk, false)
  settings.sharePreparedBackupFile()
  assert.strictEqual(shareFileCount, 1)
  assert.ok(settings.data.backupActionMessage.includes('开发者工具不支持文件分享'))
  settings.savePreparedBackupToDisk()
  assert.strictEqual(saveToDiskCount, 0)
  assert.ok(settings.data.backupActionMessage.includes('开发者工具不支持保存到电脑'))
  runtimePlatform = 'windows'
  settings.onLoad()
  assert.strictEqual(settings.data.canSaveToDisk, true)
  settings.savePreparedBackupToDisk()
  assert.strictEqual(saveToDiskCount, 1)
  assert.strictEqual(settings.data.backupActionMessage, '备份文件已保存到电脑。')

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

  let outfitFormPage
  global.Page = (config) => {
    outfitFormPage = config
  }
  delete require.cache[require.resolve('../pages/outfit-form/outfit-form')]
  require('../pages/outfit-form/outfit-form')
  resetStorage()
  store.set('privateWardrobeCustomCategories', ['上衣', '下装', '鞋子', '其他'])
  setItems([
    { id: 'coat', name: '外套 A', category: '外套' },
    { id: 'dress', name: '裙子 A', category: '连衣裙' },
    { id: 'coat-2', name: '外套 B', category: '外套' }
  ])
  const outfitForm = {
    ...outfitFormPage,
    data: JSON.parse(JSON.stringify(outfitFormPage.data)),
    setData(updates) {
      Object.assign(this.data, updates)
    }
  }
  outfitForm.loadOptions()
  assert.deepStrictEqual(outfitForm.data.categoryOptions, ['外套', '连衣裙'])
  outfitForm.openCategoryPanel({ currentTarget: { dataset: { index: 0 } } })
  assert.deepStrictEqual(outfitForm.data.categoryPanelItems.map((item) => item.name), ['外套', '连衣裙'])
  assert.ok(!outfitForm.data.categoryPanelItems.some((item) => item.name === '鞋子'))
  outfitForm.loadOutfitForEdit({
    name: '旧穿搭',
    pieces: [{ category: '旧分类', itemId: 'missing' }]
  }, false)
  assert.strictEqual(outfitForm.data.pieces[0].categoryName, '旧分类')

  let wishFormPage
  global.Page = (config) => {
    wishFormPage = config
  }
  delete require.cache[require.resolve('../pages/wish-form/wish-form')]
  require('../pages/wish-form/wish-form')
  resetStorage()
  store.set('privateWardrobeWishlist', [{
    id: 'wish-image',
    name: '图片愿望',
    category: '鞋子',
    imageUrl: 'saved://old'
  }])
  const wishPage = {
    ...wishFormPage,
    data: {
      ...JSON.parse(JSON.stringify(wishFormPage.data)),
      isEditing: true,
      form: {
        id: 'wish-image',
        imageUrl: 'saved://temp-new',
        name: '图片愿望',
        category: '鞋子',
        expectedPrice: '',
        matchItemId: '',
        note: ''
      }
    },
    originalImageUrl: 'saved://old',
    pendingImageUrl: 'saved://temp-new'
  }
  wishPage.saveWish()
  assert.deepStrictEqual(removedFiles, ['saved://old'])
  assert.strictEqual(wardrobe.getWishlistItem('wish-image').imageUrl, 'saved://temp-new')

  console.log('wardrobe tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
