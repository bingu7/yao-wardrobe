const STORAGE_KEY = 'privateWardrobeItems'
const OUTFIT_STORAGE_KEY = 'privateWardrobeOutfits'
const WISHLIST_STORAGE_KEY = 'privateWardrobeWishlist'
const WEAR_LOG_STORAGE_KEY = 'privateWardrobeWearLogs'
const CATEGORY_STORAGE_KEY = 'privateWardrobeCustomCategories'
const CATEGORY_MANAGED_KEY = 'privateWardrobeCategoriesManaged'
const OCCASION_STORAGE_KEY = 'privateWardrobeCustomOccasions'
const OCCASION_MANAGED_KEY = 'privateWardrobeOccasionsManaged'
const IDLE_ALERT_DAYS = 60

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

const starterItems = []

    // 旧数据迁移用，新穿搭不再使用固定槽位
    const legacySlotMap = [
      { key: 'topId', category: '上衣' },
      { key: 'bottomId', category: '下装' },
      { key: 'shoesId', category: '鞋子' },
      { key: 'bagId', category: '包包' },
      { key: 'accessoryId', category: '配饰' }
    ]

const starterOutfits = []

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
  if (value === '其他') {
    return { ok: false, message: '其他是兜底分类，不能删除' }
  }
  const fallback = '其他'
  const nextCategories = getCustomCategories().filter((item) => item !== value)
  if (!nextCategories.includes(fallback)) {
    nextCategories.push(fallback)
  }
  wx.setStorageSync(CATEGORY_STORAGE_KEY, nextCategories)
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  // 将使用该分类的衣物归为「其他」
  saveItems(getItems().map((item) => (
    item.category === value ? { ...item, category: fallback, updatedAt: new Date().toISOString() } : item
  )))
  saveWishlist(getWishlist().map((item) => (
    item.category === value ? { ...item, category: fallback, updatedAt: new Date().toISOString() } : item
  )))
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
  if (oldValue === '其他') {
    return { ok: false, message: '其他是兜底分类，不能重命名' }
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
  saveItems(getItems().map((item) => (
    Array.isArray(item.occasions) && item.occasions.includes(value)
      ? {
        ...item,
        occasions: item.occasions.filter((occasion) => occasion !== value),
        updatedAt: new Date().toISOString()
      }
      : item
  )))
  saveOutfits(getOutfits().map((outfit) => (
    outfit.occasion === value ? { ...outfit, occasion: '', updatedAt: new Date().toISOString() } : outfit
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

function createUniqueId(prefix, existingIds) {
  const ids = new Set(existingIds || [])
  let id = ''
  do {
    id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  } while (ids.has(id))
  return id
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

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(dateText) {
  const date = new Date(`${dateText}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDaysSince(dateText) {
  const date = parseLocalDate(dateText)
  if (!date) return null
  return Math.max(0, Math.floor((new Date() - date) / 86400000))
}

function getCurrentSeason(date) {
  const month = (date || new Date()).getMonth() + 1
  if ([3, 4, 5].includes(month)) return '春'
  if ([6, 7, 8].includes(month)) return '夏'
  if ([9, 10, 11].includes(month)) return '秋'
  return '冬'
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
  return item ? normalizeItem(item) : null
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

  const id = createUniqueId('item', items.map((current) => current.id))
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
  saveOutfits(getOutfits().map((outfit) => ({
    ...outfit,
    pieces: (outfit.pieces || []).filter((piece) => piece.itemId !== id),
    updatedAt: new Date().toISOString()
  })))
  saveWishlist(getWishlist().map((wish) => (
    wish.matchItemId === id ? { ...wish, matchItemId: '', updatedAt: new Date().toISOString() } : wish
  )))
  removeItemFromWearLogs(id)
}

function getWearLogs() {
  const saved = wx.getStorageSync(WEAR_LOG_STORAGE_KEY)
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
}

function saveWearLogs(logs) {
  wx.setStorageSync(WEAR_LOG_STORAGE_KEY, logs)
}

function normalizeIdList(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map((id) => String(id || '').trim()).filter(Boolean)))
}

function getWearLog(dateText) {
  return normalizeIdList(getWearLogs()[dateText])
}

function getLatestLogDateForItem(itemId, logs) {
  return Object.keys(logs)
    .filter((date) => normalizeIdList(logs[date]).includes(itemId))
    .sort()
    .pop() || ''
}

function setWearLog(dateText, itemIds) {
  const date = String(dateText || '').trim()
  if (!parseLocalDate(date)) {
    return { ok: false, message: '日期不正确' }
  }
  const logs = getWearLogs()
  const oldIds = normalizeIdList(logs[date])
  const nextIds = normalizeIdList(itemIds)
  logs[date] = nextIds
  saveWearLogs(logs)

  const addedIds = nextIds.filter((id) => !oldIds.includes(id))
  const removedIds = oldIds.filter((id) => !nextIds.includes(id))
  if (!addedIds.length && !removedIds.length) {
    return { ok: true, date, changed: false }
  }

  const now = new Date().toISOString()
  saveItems(getItems().map((item) => {
    if (addedIds.includes(item.id)) {
      const lastWornDate = !item.lastWornDate || item.lastWornDate < date ? date : item.lastWornDate
      return normalizeItem({
        ...item,
        wearCount: (Number(item.wearCount) || 0) + 1,
        lastWornDate,
        updatedAt: now
      })
    }
    if (removedIds.includes(item.id)) {
      const latestDate = item.lastWornDate === date ? getLatestLogDateForItem(item.id, logs) : item.lastWornDate
      return normalizeItem({
        ...item,
        wearCount: Math.max((Number(item.wearCount) || 0) - 1, 0),
        lastWornDate: latestDate,
        updatedAt: now
      })
    }
    return item
  }))
  return { ok: true, date, changed: true }
}

function removeItemFromWearLogs(itemId) {
  const logs = getWearLogs()
  const nextLogs = Object.keys(logs).reduce((next, date) => {
    const ids = normalizeIdList(logs[date]).filter((id) => id !== itemId)
    next[date] = ids
    return next
  }, {})
  saveWearLogs(nextLogs)
}

function markWorn(id, dateText) {
  const date = dateText ? formatLocalDate(dateText) : formatLocalDate(new Date())
  const ids = getWearLog(date)
  if (ids.includes(id)) {
    return { ok: false, date, alreadyRecorded: true, message: '今天已经记录过了' }
  }
  const result = setWearLog(date, [...ids, id])
  return {
    ...result,
    alreadyRecorded: false,
    message: result.ok ? '已记录穿着' : result.message
  }
}

function hydrateWearLog(dateText, items) {
  const itemMap = (items || getItems()).reduce((map, item) => {
    map[item.id] = normalizeItem(item)
    return map
  }, {})
  return getWearLog(dateText).map((id) => itemMap[id]).filter(Boolean)
}

function getWearCalendar(days) {
  const totalDays = days || 21
  const logs = getWearLogs()
  const items = getItems()
  const today = new Date()
  return Array.from({ length: totalDays }).map((_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    const dateText = formatLocalDate(date)
    const dayItems = hydrateWearLog(dateText, items)
    return {
      date: dateText,
      monthDay: dateText.slice(5),
      itemCount: normalizeIdList(logs[dateText]).length,
      names: dayItems.map((item) => item.name).join('、')
    }
  })
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
  let outfits
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
    } else {
      outfits = saved
    }
  } else {
    outfits = starterOutfits
  }
  const itemIds = new Set(getItems().map((item) => item.id))
  let changed = !Array.isArray(saved)
  const normalized = outfits.map((outfit) => {
    const seen = new Set()
    const pieces = (Array.isArray(outfit.pieces) ? outfit.pieces : []).filter((piece) => {
      if (!piece.itemId || !itemIds.has(piece.itemId) || seen.has(piece.itemId)) {
        changed = true
        return false
      }
      seen.add(piece.itemId)
      return true
    })
    return pieces.length === outfit.pieces.length ? outfit : { ...outfit, pieces }
  })
  if (changed) {
    saveOutfits(normalized)
  }
  return normalized
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
  const pieces = (Array.isArray(outfit.pieces) ? outfit.pieces : []).filter((piece) => {
    if (!piece.itemId || seen.has(piece.itemId)) {
      return false
    }
    seen.add(piece.itemId)
    return true
  })
  const nextOutfit = { ...outfit, pieces }
  const outfits = getOutfits()
  if (outfit.id) {
    saveOutfits(outfits.map((current) => (
      current.id === outfit.id ? { ...current, ...nextOutfit, updatedAt: now } : current
    )))
    return outfit.id
  }

  const id = createUniqueId('outfit', outfits.map((current) => current.id))
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
  if (!Array.isArray(saved)) return []
  const itemIds = new Set(getItems().map((item) => item.id))
  let changed = false
  const wishlist = saved.map((item) => {
    if (item.matchItemId && !itemIds.has(item.matchItemId)) {
      changed = true
      return { ...item, matchItemId: '' }
    }
    return item
  })
  if (changed) saveWishlist(wishlist)
  return wishlist
}

function saveWishlist(list) {
  wx.setStorageSync(WISHLIST_STORAGE_KEY, list)
}

function addWishlistItem(item) {
  const now = new Date().toISOString()
  saveWishlist([
    {
      ...item,
      id: createUniqueId('wish', getWishlist().map((current) => current.id)),
      createdAt: now,
      updatedAt: now
    },
    ...getWishlist()
  ])
}

function getWishlistItem(id) {
  return getWishlist().find((item) => item.id === id) || null
}

function upsertWishlistItem(item) {
  const now = new Date().toISOString()
  if (item.id) {
    saveWishlist(getWishlist().map((current) => (
      current.id === item.id ? { ...current, ...item, updatedAt: now } : current
    )))
    return item.id
  }

  const id = createUniqueId('wish', getWishlist().map((current) => current.id))
  saveWishlist([
    {
      ...item,
      id,
      createdAt: now,
      updatedAt: now
    },
    ...getWishlist()
  ])
  return id
}

function deleteWishlistItem(id) {
  const list = getWishlist()
  const item = list.find((i) => i.id === id)
  if (item && item.imageUrl) {
    removeImageFile(item.imageUrl)
  }
  saveWishlist(list.filter((i) => i.id !== id))
}

function convertWishlistToItem(id) {
  const wish = getWishlistItem(id)
  if (!wish) {
    return { ok: false, message: '愿望不存在' }
  }
  const itemId = upsertItem({
    imageUrl: wish.imageUrl || '',
    name: wish.name || '未命名衣物',
    category: wish.category || '其他',
    price: wish.expectedPrice === '' || wish.expectedPrice === undefined ? '' : Number(wish.expectedPrice) || '',
    color: '',
    seasons: [],
    occasions: [],
    purchaseDate: formatLocalDate(new Date()),
    status: '',
    note: wish.note || ''
  })
  saveWishlist(getWishlist().filter((item) => item.id !== id))
  return { ok: true, itemId }
}

function purchaseWishlistItem(id) {
  const wish = getWishlistItem(id)
  if (!wish) {
    return { ok: false, message: '愿望不存在' }
  }
  const itemId = upsertItem({
    name: wish.name || '未命名衣物',
    category: wish.category || '其他',
    price: wish.expectedPrice === '' || wish.expectedPrice === undefined ? '' : Number(wish.expectedPrice) || 0,
    imageUrl: wish.imageUrl || '',
    color: '',
    seasons: [],
    occasions: [],
    purchaseDate: formatLocalDate(new Date()),
    status: '偶尔穿',
    note: wish.note || ''
  })
  saveWishlist(getWishlist().filter((item) => item.id !== id))
  return { ok: true, itemId }
}

function batchUpdateCategory(ids, category) {
  const itemIds = normalizeIdList(ids)
  const value = String(category || '').trim()
  if (!itemIds.length) return { ok: false, message: '请选择衣物' }
  if (!value) return { ok: false, message: '请选择分类' }
  const now = new Date().toISOString()
  saveItems(getItems().map((item) => (
    itemIds.includes(item.id) ? { ...item, category: value, updatedAt: now } : item
  )))
  return { ok: true }
}

function batchAddOccasions(ids, occasions) {
  const itemIds = normalizeIdList(ids)
  const values = normalizeIdList(occasions)
  if (!itemIds.length) return { ok: false, message: '请选择衣物' }
  if (!values.length) return { ok: false, message: '请选择场合' }
  const now = new Date().toISOString()
  saveItems(getItems().map((item) => (
    itemIds.includes(item.id)
      ? {
        ...item,
        occasions: Array.from(new Set([...(Array.isArray(item.occasions) ? item.occasions : []), ...values])),
        updatedAt: now
      }
      : item
  )))
  return { ok: true }
}

function batchDeleteItems(ids) {
  const itemIds = normalizeIdList(ids)
  if (!itemIds.length) return { ok: false, message: '请选择衣物' }
  itemIds.forEach((id) => deleteItem(id))
  return { ok: true }
}

function exportData() {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    items: getItems().map((item) => ({ ...item, imageUrl: '' })),
    outfits: getOutfits(),
    wishlist: getWishlist().map((item) => ({ ...item, imageUrl: '' })),
    wearLogs: getWearLogs(),
    categories: getCustomCategories(),
    occasions: getCustomOccasions()
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : []
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
  const mergeRecords = (local, incoming, normalize) => {
    const merged = new Map(local.map((item) => [item.id, item]))
    incoming.forEach((item) => {
      const next = normalize ? normalize(item) : item
      const previous = merged.get(next.id) || {}
      merged.set(next.id, { ...previous, ...next, imageUrl: previous.imageUrl || next.imageUrl || '' })
    })
    return Array.from(merged.values())
  }
  const localCategories = toArray(wx.getStorageSync(CATEGORY_STORAGE_KEY))
  const localOccasions = toArray(wx.getStorageSync(OCCASION_STORAGE_KEY))
  const categories = uniqCategories([...localCategories, ...toArray(backup.categories), '其他'])
  const occasions = uniqCategories([...localOccasions, ...toArray(backup.occasions)])
  const mergedWearLogs = { ...getWearLogs() }
  if (backup.wearLogs && typeof backup.wearLogs === 'object') {
    Object.keys(backup.wearLogs).forEach((date) => {
      mergedWearLogs[date] = normalizeIdList([...(mergedWearLogs[date] || []), ...(backup.wearLogs[date] || [])])
    })
  }

  wx.setStorageSync(STORAGE_KEY, mergeRecords(getItems(), backup.items, normalizeItem))
  wx.setStorageSync(OUTFIT_STORAGE_KEY, mergeRecords(getOutfits(), backup.outfits))
  wx.setStorageSync(WISHLIST_STORAGE_KEY, mergeRecords(getWishlist(), backup.wishlist))
  wx.setStorageSync(WEAR_LOG_STORAGE_KEY, mergedWearLogs)
  wx.setStorageSync(CATEGORY_STORAGE_KEY, categories)
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  wx.setStorageSync(OCCASION_STORAGE_KEY, occasions)
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
  return { ok: true, count: backup.items.length, merged: true }
}

function clearAllData() {
  ;[...getItems(), ...getWishlist()].forEach((item) => {
    if (item && item.imageUrl) {
      removeImageFile(item.imageUrl)
    }
  })
  wx.setStorageSync(STORAGE_KEY, [])
  wx.setStorageSync(OUTFIT_STORAGE_KEY, [])
  wx.setStorageSync(WISHLIST_STORAGE_KEY, [])
  wx.setStorageSync(WEAR_LOG_STORAGE_KEY, {})
  wx.setStorageSync(CATEGORY_STORAGE_KEY, defaultCategories)
  wx.setStorageSync(CATEGORY_MANAGED_KEY, true)
  wx.setStorageSync(OCCASION_STORAGE_KEY, defaultOccasions)
  wx.setStorageSync(OCCASION_MANAGED_KEY, true)
  return { ok: true }
}

function getIdleStatus(item, idleDays) {
  const days = idleDays || IDLE_ALERT_DAYS
  const normalized = normalizeItem(item)
  if (Number(normalized.wearCount) === 0) {
    return {
      isIdle: true,
      text: '暂未记录穿着'
    }
  }
  const daysSince = getDaysSince(normalized.lastWornDate)
  if (daysSince !== null && daysSince >= days) {
    return {
      isIdle: true,
      text: `已 ${daysSince} 天未穿`
    }
  }
  return {
    isIdle: false,
    text: daysSince === null ? '未记录' : `${daysSince} 天前`
  }
}

function enrichItemForDisplay(item) {
  const normalized = normalizeItem(item)
  const idleStatus = getIdleStatus(normalized)
  return {
    ...normalized,
    idleStatus,
    idleText: idleStatus.text
  }
}

function getHomeInsights(items) {
  const normalizedItems = (items || getItems()).map(enrichItemForDisplay)
  const currentSeason = getCurrentSeason()
  const recentItems = normalizedItems
    .filter((item) => item.lastWornDate)
    .slice()
    .sort((a, b) => b.lastWornDate.localeCompare(a.lastWornDate))
    .slice(0, 4)
  const staleItems = normalizedItems
    .filter((item) => item.idleStatus.isIdle)
    .slice()
    .sort((a, b) => (Number(a.wearCount) || 0) - (Number(b.wearCount) || 0))
    .slice(0, 4)
  const seasonItems = normalizedItems.filter((item) => item.seasons.includes(currentSeason))
  const recommendPool = seasonItems.length ? seasonItems : normalizedItems
  const weeklyItems = recommendPool
    .filter((item) => getDaysSince(item.lastWornDate) === null || getDaysSince(item.lastWornDate) > 7)
    .slice()
    .sort((a, b) => {
      const wearDiff = (Number(a.wearCount) || 0) - (Number(b.wearCount) || 0)
      if (wearDiff !== 0) return wearDiff
      return String(a.lastWornDate || '').localeCompare(String(b.lastWornDate || ''))
    })
    .slice(0, 4)

  return {
    currentSeason,
    recentItems,
    staleItems,
    weeklyItems,
    todayRecordCount: getWearLog(formatLocalDate(new Date())).length
  }
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
  const seasonCounts = seasons.map((season) => ({
    season,
    count: normalizedItems.filter((item) => item.seasons.includes(season)).length
  })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count)
  const itemOccasions = [...new Set(normalizedItems.reduce((list, item) => (
    [...list, ...item.occasions]
  ), []))]
  const occasionCounts = itemOccasions.map((occasion) => ({
    occasion,
    count: normalizedItems.filter((item) => item.occasions.includes(occasion)).length
  })).sort((a, b) => b.count - a.count)
  const totalWearCount = normalizedItems.reduce((sum, item) => sum + (Number(item.wearCount) || 0), 0)
  const wornItems = normalizedItems.filter((item) => Number(item.wearCount) > 0)
  const pricedWornItems = wornItems.filter((item) => Number(item.price) > 0)
  const pricedWearCount = pricedWornItems.reduce((sum, item) => sum + Number(item.wearCount), 0)
  const wornItemsPrice = pricedWornItems.reduce((sum, item) => sum + Number(item.price), 0)
  const mostWornItem = wornItems.reduce((current, item) => (
    !current || Number(item.wearCount) > Number(current.wearCount) ? item : current
  ), null)
  const nowTime = Date.now()
  const longestUnwornItem = normalizedItems.reduce((current, item) => {
    const lastDate = item.lastWornDate || item.purchaseDate || item.createdAt || ''
    const daysSinceWorn = lastDate ? Math.max(0, Math.floor((nowTime - new Date(lastDate).getTime()) / 86400000)) : 0
    return !current || daysSinceWorn > current.daysSinceWorn ? { item, daysSinceWorn } : current
  }, null)
  const priceValues = pricedItems.map((item) => Number(item.price))
  const today = new Date()
  const getIdleDays = (dateText) => {
    if (!dateText) return null
    const date = new Date(`${dateText}T00:00:00`)
    if (Number.isNaN(date.getTime())) return null
    return Math.max(0, Math.floor((today - date) / 86400000))
  }
  const neverWornCount = normalizedItems.filter((item) => Number(item.wearCount) === 0).length
  const idleOver90Count = normalizedItems.filter((item) => {
    if (Number(item.wearCount) === 0) return true
    const days = getIdleDays(item.lastWornDate)
    return days !== null && days > 90
  }).length
  const mostWornItems = wornItems
    .slice()
    .sort((a, b) => (Number(b.wearCount) || 0) - (Number(a.wearCount) || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      wearCount: Number(item.wearCount) || 0
    }))
  const highestCostPerWearItems = wornItems
    .filter((item) => Number(item.price) > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      costPerWear: getCostPerWear(item)
    }))
    .sort((a, b) => b.costPerWear - a.costPerWear)
    .slice(0, 5)

  return {
    totalCount: normalizedItems.length,
    totalPrice,
    averagePrice: pricedItems.length ? Math.round(totalPrice / pricedItems.length) : 0,
    idleCount: normalizedItems.filter((item) => item.status === '闲置').length,
    neverWornCount,
    idleOver90Count,
    totalWearCount,
    wornItemCount: wornItems.length,
    averageCostPerWear: pricedWearCount
      ? Number((wornItemsPrice / pricedWearCount).toFixed(2))
      : 0,
    categoryCounts,
    seasonCounts,
    occasionCounts,
    mostWornItems,
    highestCostPerWearItems,
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
  persistImage,
  removeImageFile,
  IDLE_ALERT_DAYS,
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
  formatLocalDate,
  getCurrentSeason,
  addCustomCategory,
  deleteCustomCategory,
  renameCustomCategory,
  moveCustomCategory,
  getItems,
  getItem,
  upsertItem,
  deleteItem,
  markWorn,
  getWearLogs,
  getWearLog,
  setWearLog,
  hydrateWearLog,
  getWearCalendar,
  getCostPerWear,
  getOutfits,
  getOutfit,
  copyOutfit,
  upsertOutfit,
  deleteOutfit,
  hydrateOutfit,
  getWishlist,
  getWishlistItem,
  addWishlistItem,
  upsertWishlistItem,
  deleteWishlistItem,
  convertWishlistToItem,
  purchaseWishlistItem,
  batchUpdateCategory,
  batchAddOccasions,
  batchDeleteItems,
  exportData,
  importData,
  clearAllData,
  getIdleStatus,
  enrichItemForDisplay,
  getHomeInsights,
  summarize
}
