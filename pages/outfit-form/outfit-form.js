const wardrobe = require('../../utils/wardrobe')

function emptyForm() {
  return {
    name: '',
    occasion: '',
    note: ''
  }
}

function buildPieceData(items, allCategories, selectedCategory, selectedItemId) {
  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : []
  const itemOptions = [{ id: '', name: '选择衣物' }, ...filteredItems]
  const itemIndex = itemOptions.findIndex((item) => item.id === selectedItemId)
  const hasSelectedItem = itemIndex > 0
  return {
    categoryName: selectedCategory || '',
    itemIndex: hasSelectedItem ? itemIndex : 0,
    itemId: hasSelectedItem ? selectedItemId : '',
    displayName: hasSelectedItem ? itemOptions[itemIndex].name : '选择衣物',
    itemOptions
  }
}

function getWardrobeCategories(items) {
  return wardrobe.getCategories(items).filter((category) => category !== '全部')
}

function buildCategoryPanelItems(categories, selectedCategory) {
  return categories.map((name, index) => ({
    name,
    selected: name === selectedCategory,
    sortIndex: index
  }))
}

Page({
  data: {
    form: emptyForm(),
    pieces: [],
    categoryOptions: [],
    occasionOptions: ['不选择'],
    occasionIndex: 0,
    occasionLabel: '不选择',
    // 场合面板
    showOccasionPanel: false,
    // 物品选择面板
    showItemPanel: false,
    editingItemPieceIndex: -1,
    // 分类面板
    showCategoryPanel: false,
    editingPieceIndex: -1,
    categoryPanelItems: [],
    isEditing: false
  },

  onLoad() {
    this.loadOptions()
  },

  onShow() {
    this.refreshItemOptions()
    // 检查是否为编辑/复制模式
    const editingId = wx.getStorageSync('outfitEditingId')
    if (editingId) {
      wx.removeStorageSync('outfitEditingId')
      this.loadOutfitForEdit(editingId, true)
      return
    }
    const copyData = wx.getStorageSync('outfitCopyData')
    if (copyData) {
      wx.removeStorageSync('outfitCopyData')
      this.loadOutfitForEdit(copyData, false)
      return
    }
  },

  loadOutfitForEdit(data, keepId) {
    const outfit = keepId ? wardrobe.getOutfit(data) : data
    if (!outfit) {
      wx.showToast({ title: '穿搭不存在', icon: 'none' })
      return
    }
    const items = wardrobe.getItems()
    const allCategories = getWardrobeCategories(items)
    const occasionIndex = outfit.occasion ? Math.max(0, this.data.occasionOptions.indexOf(outfit.occasion)) : 0
    
    // 构建 pieces
    const pieces = (outfit.pieces || []).map((p) => (
      buildPieceData(items, allCategories, p.category, p.itemId)
    ))
    
    this.setData({
      isEditing: true,
      form: {
        name: outfit.name || '',
        occasion: outfit.occasion || '',
        note: outfit.note || ''
      },
      pieces: pieces.length ? pieces : [buildPieceData(items, allCategories, '')],
      editingId: keepId ? outfit.id : undefined,
      occasionIndex,
      occasionLabel: this.data.occasionOptions[occasionIndex] || '不选择'
    })
  },

  refreshItemOptions() {
    const items = wardrobe.getItems()
    const pieces = this.data.pieces.map((p) => {
      const filteredItems = p.categoryName
        ? items.filter((item) => item.category === p.categoryName)
        : []
      const itemOptions = [{ id: '', name: '选择衣物' }, ...filteredItems]
      const stillValid = p.itemId && itemOptions.some((opt) => opt.id === p.itemId)
      return {
        ...p,
        itemOptions,
        itemIndex: stillValid ? itemOptions.findIndex((opt) => opt.id === p.itemId) : 0,
        itemId: stillValid ? p.itemId : '',
        displayName: stillValid ? p.displayName : '选择衣物'
      }
    })
    this.setData({ pieces })
  },

  loadOptions() {
    const items = wardrobe.getItems()
    const allCategories = getWardrobeCategories(items)
    const occasionOptions = ['不选择', ...wardrobe.getOccasions()]
    this.setData({
      categoryOptions: allCategories,
      pieces: [buildPieceData(items, allCategories, '')],
      occasionOptions
    })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: event.detail.value })
  },

  // ── 场合面板 ──

  openOccasionPanel() {
    this.setData({ showOccasionPanel: true })
  },

  closeOccasionPanel() {
    this.setData({ showOccasionPanel: false })
  },

  selectOccasion(event) {
    const occasion = event.currentTarget.dataset.occasion
    const options = this.data.occasionOptions
    const index = options.indexOf(occasion)
    this.setData({
      occasionIndex: index >= 0 ? index : 0,
      occasionLabel: occasion,
      'form.occasion': index <= 0 ? '' : occasion,
      showOccasionPanel: false
    })
  },

  // ── 穿搭操作 ──

  addPiece() {
    if (this.data.pieces.length >= 5) return
    const items = wardrobe.getItems()
    const pieces = [...this.data.pieces, buildPieceData(items, this.data.categoryOptions, '')]
    this.setData({ pieces })
  },

  removePiece(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (this.data.pieces.length <= 1) return
    const pieces = this.data.pieces.filter((_, i) => i !== index)
    this.setData({ pieces })
  },

  // ── 分类面板 ──

  noop() {},

  openCategoryPanel(event) {
    const index = Number(event.currentTarget.dataset.index)
    const categories = getWardrobeCategories(wardrobe.getItems())
    const selectedCategory = this.data.pieces[index] ? this.data.pieces[index].categoryName : ''
    this.setData({
      categoryOptions: categories,
      editingPieceIndex: index,
      showCategoryPanel: true,
      categoryPanelItems: buildCategoryPanelItems(categories, selectedCategory)
    })
  },

  closeCategoryPanel() {
    this.setData({
      showCategoryPanel: false,
      editingPieceIndex: -1
    })
  },

  selectCategoryFromPanel(event) {
    const category = event.currentTarget.dataset.category
    const index = this.data.editingPieceIndex
    if (index < 0) return

    const items = wardrobe.getItems()
    const pieces = this.data.pieces.map((p, i) =>
      i === index ? buildPieceData(items, this.data.categoryOptions, category) : p
    )
    this.setData({
      pieces,
      showCategoryPanel: false,
      editingPieceIndex: -1
    })
  },

  // ── 物品选择面板 ──

  openItemPanel(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      showItemPanel: true,
      editingItemPieceIndex: index
    })
  },

  closeItemPanel() {
    this.setData({ showItemPanel: false, editingItemPieceIndex: -1 })
  },

  selectItem(event) {
    const id = event.currentTarget.dataset.id
    const name = event.currentTarget.dataset.name
    const index = this.data.editingItemPieceIndex
    if (index < 0) return
    const piece = this.data.pieces[index]
    const optIndex = piece.itemOptions.findIndex((opt) => opt.id === id)
    const pieces = this.data.pieces.map((p, i) =>
      i === index
        ? { ...p, itemIndex: optIndex >= 0 ? optIndex : 0, itemId: id, displayName: name }
        : p
    )
    this.setData({ pieces, showItemPanel: false, editingItemPieceIndex: -1 })
  },

  // ── 保存 ──

  saveOutfit() {
    const form = this.data.form
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写穿搭名字', icon: 'none' })
      return
    }

    const selectedPieces = this.data.pieces
      .filter((p) => p.itemId && p.categoryName)
      .map((p) => ({ category: p.categoryName, itemId: p.itemId }))

    if (selectedPieces.length < 1) {
      wx.showToast({ title: '至少选择 1 件衣物', icon: 'none' })
      return
    }

    wardrobe.upsertOutfit({
      ...form,
      ...(this.data.editingId ? { id: this.data.editingId } : {}),
      name: form.name.trim(),
      note: form.note.trim(),
      pieces: selectedPieces
    })

    wx.showToast({
      title: this.data.editingId ? '已更新穿搭' : '已保存穿搭',
      icon: 'success'
    })
    wx.navigateBack()
  },

  goBack() {
    wx.navigateBack()
  }
})
