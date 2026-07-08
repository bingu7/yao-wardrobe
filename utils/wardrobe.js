const STORAGE_KEY = 'privateWardrobeItems'
const OUTFIT_STORAGE_KEY = 'privateWardrobeOutfits'
const WISHLIST_STORAGE_KEY = 'privateWardrobeWishlist'
const CATEGORY_STORAGE_KEY = 'privateWardrobeCustomCategories'
const CATEGORY_MANAGED_KEY = 'privateWardrobeCategoriesManaged'
const OCCASION_STORAGE_KEY = 'privateWardrobeCustomOccasions'

const defaultCategories = ['连衣裙', '上衣', '下装', '外套', '鞋子', '包包', '帽子/发饰', '配饰', '其他']
const seasons = ['春', '夏', '秋', '冬']
const statuses = ['常穿', '偶尔穿', '闲置']
const defaultOccasions = ['通勤', '约会', '旅行', '拍照', '正式', '休闲', '运动']

const outfitSlots = [
  { key: 'topId', label: '上衣', categories: ['上衣', '外套'] },
  { key: 'bottomId', label: '裙子/裤子', categories: ['连衣裙', '下装'] },
  { key: 'shoesId', label: '鞋子', categories: ['鞋子'] },
  { key: 'bagId', label: '包包', categories: ['包包'] },
  { key: 'accessoryId', label: '帽子/发饰', categories: ['帽子/发饰', '配饰'] }
]

const starterItems = [
  {
    id: 'sample_001',
    name: '碎花吊带裙',
    category: '连衣裙',
    price: 299,
    imageUrl: '',
    color: '粉色',
    seasons: ['春', '夏'],
    occasions: ['旅行', '拍照'],
    purchaseDate: '2026-06-18',
    status: '常穿',
    wearCount: 1,
    lastWornDate: '2026-07-08',
    note: '适合度假和拍照',
    createdAt: '2026-07-08T12:00:00+08:00',
    updatedAt: '2026-07-08T12:00:00+08:00'
  },
  {
    id: 'sample_002',
    name: '白色衬衫',
    category: '上衣',
    price: 159,
    imageUrl: '',
    color: '白色',
    seasons: ['春', '秋'],
    occasions: ['通勤', '正式'],
    purchaseDate: '2026-05-02',
    status: '偶尔穿',
    wearCount: 0,
    lastWornDate: '',
    note: '通勤和拍证件照都能用',
    createdAt: '2026-07-08T12:00:00+08:00',
    updatedAt: '2026-07-08T12:00:00+08:00'
  }
]

const starterOutfits = [
  {
    id: 'outfit_sample_001',
    name: '周末拍照穿搭',
    topId: 'sample_002',
    bottomId: 'sample_001',
    shoesId: '',
    bagId: '',
    accessoryId: '',
    occasion: '拍照',
    note: '清爽一点，适合出门拍照',
    createdAt: '2026-07-08T12:00:00+08:00',
    updatedAt: '2026-07-08T12:00:00+08:00'
  }
]

function getItems() {
  const saved = wx.getStorageSync(STORAGE_KEY)
  if (Array.isArray(saved)) {
    return saved
  }
  wx.setStorageSync(STORAGE_KEY, starterItems)
  return starterItems
}

function getCustomCategories() {
  const saved = wx.getStorageSync(CATEGORY_STORAGE_KEY)
  if (wx.getStorageSync(CATEGORY_MANAGED_KEY) === true) {
    return Array.isArray(saved) ? saved : []
  }
  const migrated = uniqCategories([...defaultCategories, ...(Array.isArray(saved) ? saved : [])])
  wx.setStorageSync(CATEGORY_STORAGE_KEY, migrated)
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  return migrated
}

function uniqCategories(list) {
  return Array.from(new Set(list.map((item) => String(item || '').trim()).filter(Boolean)))
}

function getFormCategories() {
  return getCustomCategories()
}

function getCategories(items) {
  const itemCategories = [...new Set(items.map((item) => item.category).filter(Boolean))]
  return ['全部', ...itemCategories]
}

function addCustomCategory(category) {
  const value = String(category || '').trim()
  if (!value) {
    return { ok: false, message: '请输入分类名称' }
  }
  if (value === '全部') {
    return { ok: false, message: '分类不能叫全部' }
  }
  const existing = getFormCategories()
  if (existing.includes(value)) {
    return { ok: false, message: '这个分类已存在' }
  }
  wx.setStorageSync(CATEGORY_STORAGE_KEY, [...getCustomCategories(), value])
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  return { ok: true, category: value }
}

function deleteCustomCategory(category) {
  const value = String(category || '').trim()
  if (!value) {
    return { ok: false, message: '分类不存在' }
  }
  wx.setStorageSync(CATEGORY_STORAGE_KEY, getCustomCategories().filter((item) => item !== value))
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  return { ok: true }
}

function renameCustomCategory(oldCategory, newCategory) {
  const oldValue = String(oldCategory || '').trim()
  const newValue = String(newCategory || '').trim()
  if (!oldValue || !newValue) {
    return { ok: false, message: '请输入分类名称' }
  }
  if (oldValue === newValue) {
    return { ok: true, category: oldValue }
  }
  if (newValue === '全部') {
    return { ok: false, message: '分类不能叫全部' }
  }
  const existing = getFormCategories().filter((item) => item !== oldValue)
  if (existing.includes(newValue)) {
    return { ok: false, message: '这个分类已存在' }
  }

  wx.setStorageSync(
    CATEGORY_STORAGE_KEY,
    getCustomCategories().map((item) => (item === oldValue ? newValue : item))
  )
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  saveItems(getItems().map((item) => (
    item.category === oldValue ? { ...item, category: newValue, updatedAt: new Date().toISOString() } : item
  )))
  saveWishlist(getWishlist().map((item) => (
    item.category === oldValue ? { ...item, category: newValue, updatedAt: new Date().toISOString() } : item
  )))
  return { ok: true, category: newValue }
}

function moveCustomCategory(category, offset) {
  const value = String(category || '').trim()
  const categories = getCustomCategories()
  const index = categories.indexOf(value)
  const nextIndex = index + offset
  if (index < 0 || nextIndex < 0 || nextIndex >= categories.length) {
    return { ok: false, message: '已经到头了' }
  }
  const nextCategories = categories.slice()
  const [item] = nextCategories.splice(index, 1)
  nextCategories.splice(nextIndex, 0, item)
  wx.setStorageSync(CATEGORY_STORAGE_KEY, nextCategories)
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  return { ok: true }
}

function getCustomOccasions() {
  const saved = wx.getStorageSync(OCCASION_STORAGE_KEY)
  return Array.isArray(saved) ? saved : []
}

function getOccasions() {
  const itemOccasions = getItems().reduce((list, item) => (
    Array.isArray(item.occasions) ? [...list, ...item.occasions] : list
  ), [])
  return uniqCategories([...defaultOccasions, ...getCustomOccasions(), ...itemOccasions])
}

function addCustomOccasion(occasion) {
  const value = String(occasion || '').trim()
  if (!value) {
    return { ok: false, message: '请输入场合名称' }
  }
  const existing = getOccasions()
  if (existing.includes(value)) {
    return { ok: false, message: '这个场合已存在' }
  }
  wx.setStorageSync(OCCASION_STORAGE_KEY, [...getCustomOccasions(), value])
  return { ok: true, occasion: value }
}

function deleteCustomOccasion(occasion) {
  const value = String(occasion || '').trim()
  if (!value) {
    return { ok: false, message: '场合不存在' }
  }
  if (defaultOccasions.includes(value)) {
    return { ok: false, message: '默认场合不能删除' }
  }
  wx.setStorageSync(OCCASION_STORAGE_KEY, getCustomOccasions().filter((item) => item !== value))
  return { ok: true }
}

function normalizeItem(item) {
  return {
    ...item,
    occasions: Array.isArray(item.occasions) ? item.occasions : [],
    seasons: Array.isArray(item.seasons) ? item.seasons : [],
    wearCount: Number(item.wearCount) || 0,
    lastWornDate: item.lastWornDate || ''
  }
}

function saveItems(items) {
  wx.setStorageSync(STORAGE_KEY, items)
}

/** 将临时图片文件保存到持久化存储，返回持久化路径 */
function persistImage(tempFilePath) {
  return new Promise((resolve) => {
    wx.saveFile({
      tempFilePath,
      success: (res) => resolve(res.savedFilePath),
      fail: () => resolve(tempFilePath) // 保底：返回临时路径
    })
  })
}

/** 删除持久化的图片文件，避免堆积占用存储空间 */
function removeImageFile(filePath) {
  if (!filePath) return
  wx.getSavedFileList({
    success: (res) => {
      const match = res.fileList.find((f) => f.filePath === filePath)
      if (match) {
        wx.removeSavedFile({ filePath })
      }
    }
  })
}

function getItem(id) {
  const item = getItems().find((current) => current.id === id)
  return item ? normalizeItem(item) : undefined
}

function upsertItem(item) {
  const now = new Date().toISOString()
  const items = getItems()
  if (item.id) {
    const nextItems = items.map((current) => {
      if (current.id !== item.id) {
        return current
      }
      return normalizeItem({
        ...current,
        ...item,
        updatedAt: now
      })
    })
    saveItems(nextItems)
    return item.id
  }

  const id = `item_${Date.now()}`
  saveItems([
    normalizeItem({
      ...item,
      id,
      createdAt: now,
      updatedAt: now
    }),
    ...items
  ])
  return id
}

function deleteItem(id) {
  const items = getItems()
  const item = items.find((i) => i.id === id)
  if (item && item.imageUrl) {
    removeImageFile(item.imageUrl)
  }
  saveItems(items.filter((i) => i.id !== id))
}

function markWorn(id) {
  const today = new Date().toISOString().slice(0, 10)
  const items = getItems().map((item) => {
    if (item.id !== id) {
      return item
    }
    return normalizeItem({
      ...item,
      wearCount: (Number(item.wearCount) || 0) + 1,
      lastWornDate: today,
      updatedAt: new Date().toISOString()
    })
  })
  saveItems(items)
}

function getCostPerWear(item) {
  const price = Number(item.price) || 0
  const wearCount = Number(item.wearCount) || 0
  if (!price || !wearCount) {
    return 0
  }
  return Number((price / wearCount).toFixed(2))
}

function getOutfits() {
  const saved = wx.getStorageSync(OUTFIT_STORAGE_KEY)
  if (Array.isArray(saved)) {
    return saved
  }
  wx.setStorageSync(OUTFIT_STORAGE_KEY, starterOutfits)
  return starterOutfits
}

function saveOutfits(outfits) {
  wx.setStorageSync(OUTFIT_STORAGE_KEY, outfits)
}

function upsertOutfit(outfit) {
  const now = new Date().toISOString()
  const outfits = getOutfits()
  if (outfit.id) {
    saveOutfits(outfits.map((current) => (
      current.id === outfit.id ? { ...current, ...outfit, updatedAt: now } : current
    )))
    return outfit.id
  }

  const id = `outfit_${Date.now()}`
  saveOutfits([
    {
      ...outfit,
      id,
      createdAt: now,
      updatedAt: now
    },
    ...outfits
  ])
  return id
}

function deleteOutfit(id) {
  saveOutfits(getOutfits().filter((outfit) => outfit.id !== id))
}

function hydrateOutfit(outfit, items) {
  const itemMap = items.reduce((map, item) => {
    map[item.id] = item
    return map
  }, {})
  return {
    ...outfit,
    pieces: outfitSlots.map((slot) => ({
      ...slot,
      item: itemMap[outfit[slot.key]] || null,
      imageUrl: itemMap[outfit[slot.key]] ? itemMap[outfit[slot.key]].imageUrl : '',
      name: itemMap[outfit[slot.key]] ? itemMap[outfit[slot.key]].name : '未选择'
    }))
  }
}

function getWishlist() {
  const saved = wx.getStorageSync(WISHLIST_STORAGE_KEY)
  return Array.isArray(saved) ? saved : []
}

function saveWishlist(list) {
  wx.setStorageSync(WISHLIST_STORAGE_KEY, list)
}

function addWishlistItem(item) {
  const now = new Date().toISOString()
  saveWishlist([
    {
      ...item,
      id: `wish_${Date.now()}`,
      createdAt: now,
      updatedAt: now
    },
    ...getWishlist()
  ])
}

function deleteWishlistItem(id) {
  const list = getWishlist()
  const item = list.find((i) => i.id === id)
  if (item && item.imageUrl) {
    removeImageFile(item.imageUrl)
  }
  saveWishlist(list.filter((i) => i.id !== id))
}

function summarize(items) {
  const normalizedItems = items.map(normalizeItem)
  const pricedItems = normalizedItems.filter((item) => Number(item.price) > 0)
  const totalPrice = pricedItems.reduce((sum, item) => sum + Number(item.price), 0)
  const itemCategories = [...new Set(normalizedItems.map((item) => item.category).filter(Boolean))]
  const categoryCounts = itemCategories.map((category) => ({
    category,
    count: normalizedItems.filter((item) => item.category === category).length
  })).sort((a, b) => b.count - a.count)
  const totalWearCount = normalizedItems.reduce((sum, item) => sum + (Number(item.wearCount) || 0), 0)
  const wornItems = normalizedItems.filter((item) => Number(item.wearCount) > 0)

  return {
    totalCount: normalizedItems.length,
    totalPrice,
    averagePrice: pricedItems.length ? Math.round(totalPrice / pricedItems.length) : 0,
    idleCount: normalizedItems.filter((item) => item.status === '闲置').length,
    totalWearCount,
    wornItemCount: wornItems.length,
    averageCostPerWear: wornItems.length
      ? Number((wornItems.reduce((sum, item) => sum + getCostPerWear(item), 0) / wornItems.length).toFixed(2))
      : 0,
    categoryCounts
  }
}

module.exports = {
  defaultCategories,
  seasons,
  statuses,
  defaultOccasions,
  persistImage,
  removeImageFile,
  getCustomOccasions,
  getOccasions,
  addCustomOccasion,
  deleteCustomOccasion,
  outfitSlots,
  getCategories,
  getCustomCategories,
  getFormCategories,
  addCustomCategory,
  deleteCustomCategory,
  renameCustomCategory,
  moveCustomCategory,
  getItems,
  getItem,
  upsertItem,
  deleteItem,
  markWorn,
  getCostPerWear,
  getOutfits,
  upsertOutfit,
  deleteOutfit,
  hydrateOutfit,
  getWishlist,
  addWishlistItem,
  deleteWishlistItem,
  summarize
}
