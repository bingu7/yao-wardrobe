const STORAGE_KEY = 'privateWardrobeItems'
const OUTFIT_STORAGE_KEY = 'privateWardrobeOutfits'
const WISHLIST_STORAGE_KEY = 'privateWardrobeWishlist'
const CATEGORY_STORAGE_KEY = 'privateWardrobeCustomCategories'
const CATEGORY_MANAGED_KEY = 'privateWardrobeCategoriesManaged'
const OCCASION_STORAGE_KEY = 'privateWardrobeCustomOccasions'
const OCCASION_MANAGED_KEY = 'privateWardrobeOccasionsManaged'

const defaultCategories = ['连衣裙', '上衣', '下装', '外套', '鞋子', '包包', '帽子/发饰', '配饰', '其他']
const seasons = ['春', '夏', '秋', '冬']
const statuses = ['常穿', '偶尔穿', '闲置']
const defaultOccasions = ['通勤', '约会', '旅行', '拍照', '正式', '休闲', '运动']

function formatLocalDate(date) {
  const value = date || new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

    // 旧数据迁移用，新穿搭不再使用固定槽位
    const legacySlotMap = [
      { key: 'topId', category: '上衣' },
      { key: 'bottomId', category: '下装' },
      { key: 'shoesId', category: '鞋子' },
      { key: 'bagId', category: '包包' },
      { key: 'accessoryId', category: '配饰' }
    ]

    const starterOutfits = [
      {
        id: 'outfit_sample_001',
        name: '周末拍照穿搭',
        pieces: [
          { category: '上衣', itemId: 'sample_002' },
          { category: '连衣裙', itemId: 'sample_001' }
        ],
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
  // 将使用该分类的衣物归为「其他」
  const fallback = '其他'
  const now = new Date().toISOString()
  saveItems(getItems().map((item) => (
    item.category === value ? { ...item, category: fallback, updatedAt: now } : item
  )))
  saveWishlist(getWishlist().map((item) => (
    item.category === value ? { ...item, category: fallback, updatedAt: now } : item
  )))
  saveOutfits(getOutfits().map((outfit) => ({
    ...outfit,
    pieces: outfit.pieces.map((piece) => (
      piece.category === value ? { ...piece, category: fallback } : piece
    ))
  })))
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
  saveOutfits(getOutfits().map((outfit) => ({
    ...outfit,
    pieces: outfit.pieces.map((piece) => (
      piece.category === oldValue ? { ...piece, category: newValue } : piece
    ))
  })))
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
  if (wx.getStorageSync(OCCASION_MANAGED_KEY) === true) {
    return Array.isArray(saved) ? saved : []
  }
  const itemOccasions = getItems().reduce((list, item) => (
    Array.isArray(item.occasions) ? [...list, ...item.occasions] : list
  ), [])
  const migrated = uniqCategories([...defaultOccasions, ...(Array.isArray(saved) ? saved : []), ...itemOccasions])
  wx.setStorageSync(OCCASION_STORAGE_KEY, migrated)
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
  return migrated
}

function getOccasions() {
  return getCustomOccasions()
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
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
  return { ok: true, occasion: value }
}

function deleteCustomOccasion(occasion) {
  const value = String(occasion || '').trim()
  if (!value) {
    return { ok: false, message: '场合不存在' }
  }
  wx.setStorageSync(OCCASION_STORAGE_KEY, getCustomOccasions().filter((item) => item !== value))
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
  const now = new Date().toISOString()
  saveItems(getItems().map((item) => (
    Array.isArray(item.occasions) && item.occasions.includes(value)
      ? {
        ...item,
        occasions: item.occasions.filter((occasionName) => occasionName !== value),
        updatedAt: now
      }
      : item
  )))
  saveOutfits(getOutfits().map((outfit) => (
    outfit.occasion === value ? { ...outfit, occasion: '', updatedAt: now } : outfit
  )))
  return { ok: true }
}

function renameCustomOccasion(oldOccasion, newOccasion) {
  const oldValue = String(oldOccasion || '').trim()
  const newValue = String(newOccasion || '').trim()
  if (!oldValue || !newValue) {
    return { ok: false, message: '请输入场合名称' }
  }
  if (oldValue === newValue) {
    return { ok: true, occasion: oldValue }
  }
  const existing = getOccasions().filter((item) => item !== oldValue)
  if (existing.includes(newValue)) {
    return { ok: false, message: '这个场合已存在' }
  }

  wx.setStorageSync(
    OCCASION_STORAGE_KEY,
    getCustomOccasions().map((item) => (item === oldValue ? newValue : item))
  )
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
  saveItems(getItems().map((item) => (
    Array.isArray(item.occasions) && item.occasions.includes(oldValue)
      ? {
        ...item,
        occasions: item.occasions.map((occasion) => (occasion === oldValue ? newValue : occasion)),
        updatedAt: new Date().toISOString()
      }
      : item
  )))
  saveOutfits(getOutfits().map((outfit) => (
    outfit.occasion === oldValue ? { ...outfit, occasion: newValue, updatedAt: new Date().toISOString() } : outfit
  )))
  return { ok: true, occasion: newValue }
}

function moveCustomOccasion(occasion, offset) {
  const value = String(occasion || '').trim()
  const occasions = getCustomOccasions()
  const index = occasions.indexOf(value)
  const nextIndex = index + offset
  if (index < 0 || nextIndex < 0 || nextIndex >= occasions.length) {
    return { ok: false, message: '已经到头了' }
  }
  const nextOccasions = occasions.slice()
  const [item] = nextOccasions.splice(index, 1)
  nextOccasions.splice(nextIndex, 0, item)
  wx.setStorageSync(OCCASION_STORAGE_KEY, nextOccasions)
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
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

/** 公用：构建分类面板的 items 数组 */
function buildCategoryPanelItems(categories, customCategories, selectedCategory) {
  return categories.map((name, index) => ({
    name,
    draftName: name,
    selected: name === selectedCategory,
    canMoveUp: index > 0,
    canMoveDown: index < categories.length - 1,
    sortIndex: index
  }))
}

/** 公用：构建自定义列表的展开/收起视图 */
function buildCustomView(items, showAll, limit) {
  const count = limit || 2
  const hiddenCount = Math.max(items.length - count, 0)
  return {
    visibleItems: showAll ? items : items.slice(0, count),
    hiddenCount,
    toggleText: showAll ? '收起' : `展开 ${hiddenCount} 个`
  }
}

/** 公用：搜索防抖 */
function createDebounce(wait) {
  let timer = null
  return function (fn) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, wait || 300)
  }
}

function saveItems(items) {
  wx.setStorageSync(STORAGE_KEY, items)
}

/** 将临时图片文件保存到持久化存储，返回持久化路径 */
function persistImage(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.saveFile({
      tempFilePath,
      success: (res) => resolve(res.savedFilePath),
      fail: (error) => reject(error)
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
  const now = new Date().toISOString()
  const outfits = getOutfits().map((outfit) => {
    const pieces = outfit.pieces.filter((piece) => piece.itemId !== id)
    return pieces.length === outfit.pieces.length
      ? outfit
      : {
        ...outfit,
        pieces,
        invalidPieceCount: (Number(outfit.invalidPieceCount) || 0) + (outfit.pieces.length - pieces.length),
        updatedAt: now
      }
  })
  const wishlist = getWishlist().map((wish) => (
    wish.matchItemId === id ? { ...wish, matchItemId: '', updatedAt: now } : wish
  ))
  if (item && item.imageUrl) {
    removeImageFile(item.imageUrl)
  }
  saveItems(items.filter((i) => i.id !== id))
  saveOutfits(outfits)
  saveWishlist(wishlist)
}

function markWorn(id, date) {
  const today = formatLocalDate(date)
  let found = false
  let alreadyRecorded = false
  const items = getItems().map((item) => {
    if (item.id !== id) {
      return item
    }
    found = true
    if (item.lastWornDate === today) {
      alreadyRecorded = true
      return item
    }
    return normalizeItem({
      ...item,
      wearCount: (Number(item.wearCount) || 0) + 1,
      lastWornDate: today,
      updatedAt: new Date().toISOString()
    })
  })
  if (found && !alreadyRecorded) {
    saveItems(items)
  }
  return {
    ok: found && !alreadyRecorded,
    message: alreadyRecorded ? '今天已经记录过了' : (found ? '已记录穿着' : '衣物不存在')
  }
}

function getCostPerWear(item) {
  const price = Number(item.price) || 0
  const wearCount = Number(item.wearCount) || 0
  if (!price || !wearCount) {
    return 0
  }
  return Number((price / wearCount).toFixed(2))
}

function normalizeOutfitReferences(outfits, items) {
  const itemMap = items.reduce((map, item) => {
    map[item.id] = item
    return map
  }, {})
  let changed = false
  const normalized = outfits.map((outfit) => {
    const sourcePieces = Array.isArray(outfit.pieces) ? outfit.pieces : []
    if (!Array.isArray(outfit.pieces)) {
      changed = true
    }
    const seen = new Set()
    let missingCount = Number(outfit.invalidPieceCount) || 0
    const pieces = sourcePieces.reduce((list, piece) => {
      if (seen.has(piece.itemId)) {
        changed = true
        return list
      }
      seen.add(piece.itemId)
      const item = itemMap[piece.itemId]
      if (!item) {
        changed = true
        missingCount += 1
        return list
      }
      const category = item.category || piece.category || ''
      if (category !== piece.category) {
        changed = true
      }
      list.push({ ...piece, category })
      return list
    }, [])
    const samePieces = pieces.length === sourcePieces.length && pieces.every((piece, index) => (
      piece.category === sourcePieces[index].category
    ))
    const next = samePieces && missingCount === (Number(outfit.invalidPieceCount) || 0)
      ? outfit
      : { ...outfit, pieces, invalidPieceCount: missingCount }
    return next
  })
  return { changed, outfits: normalized }
}

function getOutfits() {
  const saved = wx.getStorageSync(OUTFIT_STORAGE_KEY)
  let outfits
  let shouldSave = false
  if (Array.isArray(saved)) {
    // 自动迁移旧数据：把 topId/bottomId 等格式转为 pieces 数组
    const needsMigration = saved.some((o) => !Array.isArray(o.pieces))
    if (needsMigration) {
      outfits = saved.map((o) => {
        if (Array.isArray(o.pieces)) return o
        const pieces = []
        for (const slot of legacySlotMap) {
          if (o[slot.key]) {
            pieces.push({ category: slot.category, itemId: o[slot.key] })
          }
        }
        const { topId, bottomId, shoesId, bagId, accessoryId, ...rest } = o
        return { ...rest, pieces }
      })
      shouldSave = true
    } else {
      outfits = saved
    }
  } else {
    outfits = starterOutfits
    shouldSave = true
  }
  const normalized = normalizeOutfitReferences(outfits, getItems())
  if (shouldSave || normalized.changed) {
    saveOutfits(normalized.outfits)
  }
  return normalized.outfits
}

function saveOutfits(outfits) {
  wx.setStorageSync(OUTFIT_STORAGE_KEY, outfits)
}

function getOutfit(id) {
  return getOutfits().find((o) => o.id === id) || null
}

function copyOutfit(id) {
  const outfit = getOutfit(id)
  if (!outfit) return null
  const { id: _id, createdAt: _created, updatedAt: _updated, ...rest } = outfit
  return rest
}

function upsertOutfit(outfit) {
  const now = new Date().toISOString()
  const seen = new Set()
  const uniquePieces = (Array.isArray(outfit.pieces) ? outfit.pieces : []).filter((piece) => {
    if (!piece.itemId || seen.has(piece.itemId)) {
      return false
    }
    seen.add(piece.itemId)
    return true
  })
  const nextOutfit = { ...outfit, pieces: uniquePieces }
  const outfits = getOutfits()
  if (outfit.id) {
    saveOutfits(outfits.map((current) => (
      current.id === outfit.id ? { ...current, ...nextOutfit, updatedAt: now } : current
    )))
    return outfit.id
  }

  const id = `outfit_${Date.now()}`
  saveOutfits([
    {
      ...nextOutfit,
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
    pieces: (outfit.pieces || []).map((piece) => {
      const item = itemMap[piece.itemId] || null
      return {
        ...piece,
        item,
        imageUrl: item ? item.imageUrl : '',
        name: item ? item.name : '未选择'
      }
    })
  }
}

function getWishlist() {
  const saved = wx.getStorageSync(WISHLIST_STORAGE_KEY)
  if (!Array.isArray(saved)) {
    return []
  }
  const itemIds = new Set(getItems().map((item) => item.id))
  let changed = false
  const normalized = saved.map((item) => {
    if (!item.matchItemId || itemIds.has(item.matchItemId)) {
      return item
    }
    changed = true
    return { ...item, matchItemId: '', updatedAt: new Date().toISOString() }
  })
  if (changed) {
    saveWishlist(normalized)
  }
  return normalized
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

function purchaseWishlistItem(id) {
  const wish = getWishlist().find((item) => item.id === id)
  if (!wish) {
    return { ok: false, message: '愿望不存在' }
  }
  const itemId = upsertItem({
    name: wish.name,
    category: wish.category || '其他',
    price: wish.expectedPrice === '' ? '' : Number(wish.expectedPrice) || 0,
    imageUrl: wish.imageUrl || '',
    color: '',
    seasons: [],
    occasions: [],
    purchaseDate: formatLocalDate(),
    status: '偶尔穿',
    note: wish.note || ''
  })
  saveWishlist(getWishlist().filter((item) => item.id !== id))
  return { ok: true, itemId }
}

function exportData() {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    items: getItems().map((item) => ({ ...item, imageUrl: '' })),
    outfits: getOutfits(),
    wishlist: getWishlist().map((item) => ({ ...item, imageUrl: '' })),
    categories: getCustomCategories(),
    occasions: getOccasions()
  }
}

function importData(input) {
  let backup = input
  if (typeof input === 'string') {
    try {
      backup = JSON.parse(input)
    } catch (error) {
      return { ok: false, message: '备份内容不是有效 JSON' }
    }
  }
  if (!backup || !Array.isArray(backup.items) || !Array.isArray(backup.outfits) || !Array.isArray(backup.wishlist)) {
    return { ok: false, message: '备份缺少必要数据' }
  }
  const mergeRecords = (local, incoming) => {
    const merged = new Map(local.map((item) => [item.id, item]))
    incoming.forEach((item) => {
      const previous = merged.get(item.id) || {}
      merged.set(item.id, {
        ...previous,
        ...item,
        imageUrl: previous.imageUrl || item.imageUrl || ''
      })
    })
    return Array.from(merged.values())
  }
  const localItems = wx.getStorageSync(STORAGE_KEY)
  const localOutfits = wx.getStorageSync(OUTFIT_STORAGE_KEY)
  const localWishlist = wx.getStorageSync(WISHLIST_STORAGE_KEY)
  const localCategories = wx.getStorageSync(CATEGORY_STORAGE_KEY)
  const localOccasions = wx.getStorageSync(OCCASION_STORAGE_KEY)
  const categories = Array.isArray(backup.categories)
    ? uniqCategories([...(Array.isArray(localCategories) ? localCategories : []), ...backup.categories])
    : (Array.isArray(localCategories) ? localCategories : [])
  const occasions = Array.isArray(backup.occasions)
    ? uniqCategories([...(Array.isArray(localOccasions) ? localOccasions : []), ...backup.occasions])
    : (Array.isArray(localOccasions) ? localOccasions : [])
  wx.setStorageSync(STORAGE_KEY, mergeRecords(
    Array.isArray(localItems) ? localItems : [],
    backup.items.map((item) => ({ ...normalizeItem(item), imageUrl: '' }))
  ))
  wx.setStorageSync(OUTFIT_STORAGE_KEY, mergeRecords(Array.isArray(localOutfits) ? localOutfits : [], backup.outfits))
  wx.setStorageSync(WISHLIST_STORAGE_KEY, mergeRecords(
    Array.isArray(localWishlist) ? localWishlist : [],
    backup.wishlist.map((item) => ({ ...item, imageUrl: '' }))
  ))
  wx.setStorageSync(CATEGORY_STORAGE_KEY, categories)
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  wx.setStorageSync(OCCASION_STORAGE_KEY, uniqCategories(occasions))
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
  return { ok: true, count: backup.items.length, merged: true }
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
  const pricedWornItems = wornItems.filter((item) => Number(item.price) > 0)
  const pricedWearCount = pricedWornItems.reduce((sum, item) => sum + Number(item.wearCount), 0)
  const wornItemsPrice = pricedWornItems.reduce((sum, item) => sum + Number(item.price), 0)
  const mostWornItem = normalizedItems.filter((item) => Number(item.wearCount) > 0).reduce((current, item) => (
    !current || Number(item.wearCount) > Number(current.wearCount) ? item : current
  ), null)
  const now = Date.now()
  const longestUnwornItem = normalizedItems.reduce((current, item) => {
    const lastDate = item.lastWornDate || item.purchaseDate || item.createdAt || ''
    const daysSinceWorn = lastDate ? Math.max(0, Math.floor((now - new Date(lastDate).getTime()) / 86400000)) : 0
    if (!current || daysSinceWorn > current.daysSinceWorn) {
      return { item, daysSinceWorn }
    }
    return current
  }, null)
  const priceValues = pricedItems.map((item) => Number(item.price))

  return {
    totalCount: normalizedItems.length,
    totalPrice,
    averagePrice: pricedItems.length ? Math.round(totalPrice / pricedItems.length) : 0,
    idleCount: normalizedItems.filter((item) => item.status === '闲置').length,
    totalWearCount,
    wornItemCount: wornItems.length,
    averageCostPerWear: pricedWearCount
      ? Number((wornItemsPrice / pricedWearCount).toFixed(2))
      : 0,
    categoryCounts,
    mostWornItem: mostWornItem || { name: '', wearCount: 0 },
    longestUnwornItem: longestUnwornItem || { item: { name: '' }, daysSinceWorn: 0 },
    priceRange: priceValues.length
      ? { min: Math.min(...priceValues), max: Math.max(...priceValues) }
      : { min: 0, max: 0 }
  }
}

module.exports = {
  defaultCategories,
  seasons,
  statuses,
  defaultOccasions,
  formatLocalDate,
  persistImage,
  removeImageFile,
  getCustomOccasions,
  getOccasions,
  addCustomOccasion,
  deleteCustomOccasion,
  renameCustomOccasion,
  moveCustomOccasion,
  getCategories,
  getCustomCategories,
  getFormCategories,
  buildCategoryPanelItems,
  buildCustomView,
  createDebounce,
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
  getOutfit,
  copyOutfit,
  upsertOutfit,
  deleteOutfit,
  hydrateOutfit,
  getWishlist,
  addWishlistItem,
  deleteWishlistItem,
  purchaseWishlistItem,
  exportData,
  importData,
  summarize
}
