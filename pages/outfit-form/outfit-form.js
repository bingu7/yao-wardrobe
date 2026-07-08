const wardrobe = require('../../utils/wardrobe')

function emptyForm() {
  return {
    name: '',
    occasion: '',
    note: ''
  }
}

function buildPieceData(items, allCategories, selectedCategory) {
  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : []
  const itemOptions = [{ id: '', name: '选择衣物' }, ...filteredItems]
  return {
    categoryName: selectedCategory || '',
    itemIndex: 0,
    itemId: '',
    displayName: '选择衣物',
    itemOptions
  }
}

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

Page({
  data: {
    form: emptyForm(),
    pieces: [],
    categoryOptions: [],
    occasionOptions: ['不选择'],
    occasionIndex: 0,
    occasionLabel: '不选择',
    // 分类面板
    showCategoryPanel: false,
    editingPieceIndex: -1,
    categoryPanelItems: [],
    isCategoryEditing: false,
    customCategory: ''
  },

  onLoad() {
    this.loadOptions()
  },

  onShow() {
    this.refreshItemOptions()
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
    const allCategories = wardrobe.getFormCategories()
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

  onOccasionChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      occasionIndex: index,
      occasionLabel: this.data.occasionOptions[index],
      'form.occasion': index === 0 ? '' : this.data.occasionOptions[index]
    })
  },

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
    const categories = wardrobe.getFormCategories()
    const customCategories = wardrobe.getCustomCategories()
    const selectedCategory = this.data.pieces[index] ? this.data.pieces[index].categoryName : ''
    this.setData({
      editingPieceIndex: index,
      showCategoryPanel: true,
      isCategoryEditing: false,
      customCategory: '',
      categoryPanelItems: buildCategoryPanelItems(categories, customCategories, selectedCategory)
    })
  },

  closeCategoryPanel() {
    this.setData({
      showCategoryPanel: false,
      isCategoryEditing: false,
      editingPieceIndex: -1
    })
  },

  toggleCategoryEditing() {
    this.setData({ isCategoryEditing: !this.data.isCategoryEditing })
  },

  selectCategoryFromPanel(event) {
    if (this.data.isCategoryEditing) return
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

  onCustomCategoryInput(event) {
    this.setData({ customCategory: event.detail.value })
  },

  addCustomCategory() {
    const result = wardrobe.addCustomCategory(this.data.customCategory)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const categories = wardrobe.getFormCategories()
    const customCategories = wardrobe.getCustomCategories()
    this.setData({
      categoryOptions: categories,
      customCategory: '',
      showCategoryPanel: true,
      categoryPanelItems: buildCategoryPanelItems(categories, customCategories, result.category)
    })
    // 如果编辑的 piece 存在，自动选中新分类
    const index = this.data.editingPieceIndex
    if (index >= 0) {
      const items = wardrobe.getItems()
      const pieces = this.data.pieces.map((p, i) =>
        i === index ? buildPieceData(items, categories, result.category) : p
      )
      this.setData({ pieces })
    }
    wx.showToast({ title: '已添加分类', icon: 'success' })
  },

  onCategoryDraftInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ [`categoryPanelItems[${index}].draftName`]: event.detail.value })
  },

  renameCategoryFromPanel(event) {
    const index = Number(event.currentTarget.dataset.index)
    const item = this.data.categoryPanelItems[index]
    if (!item) return
    const result = wardrobe.renameCustomCategory(item.name, item.draftName)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const categories = wardrobe.getFormCategories()
    this.setData({
      categoryOptions: categories,
      categoryPanelItems: buildCategoryPanelItems(categories, wardrobe.getCustomCategories(), result.category)
    })
    wx.showToast({ title: '已更新分类', icon: 'success' })
  },

  moveCategoryFromPanel(event) {
    const category = event.currentTarget.dataset.category
    const direction = Number(event.currentTarget.dataset.direction)
    const result = wardrobe.moveCustomCategory(category, direction)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const categories = wardrobe.getFormCategories()
    this.setData({
      categoryOptions: categories,
      categoryPanelItems: buildCategoryPanelItems(categories, wardrobe.getCustomCategories(),
        this.data.pieces[this.data.editingPieceIndex]?.categoryName || '')
    })
  },

  deleteCustomCategory(event) {
    const category = event.currentTarget.dataset.category
    wx.showModal({
      title: '删除分类',
      content: `确定删除"${category}"吗？已保存衣物不会被删除。`,
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) return
        wardrobe.deleteCustomCategory(category)
        const categories = wardrobe.getFormCategories()
        const pieces = this.data.pieces.map((p) =>
          p.categoryName === category ? buildPieceData(wardrobe.getItems(), categories, '') : p
        )
        this.setData({
          categoryOptions: categories,
          pieces,
          showCategoryPanel: true,
          categoryPanelItems: buildCategoryPanelItems(categories, wardrobe.getCustomCategories(),
            this.data.pieces[this.data.editingPieceIndex]?.categoryName || '')
        })
      }
    })
  },

  // ── 衣物选择 ──

  onPieceItemChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const piece = this.data.pieces[index]
    const itemIndex = Number(event.detail.value)
    const selected = piece.itemOptions[itemIndex]
    const pieces = this.data.pieces.map((p, i) =>
      i === index
        ? { ...p, itemIndex, itemId: selected.id, displayName: selected.name }
        : p
    )
    this.setData({ pieces })
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
      name: form.name.trim(),
      note: form.note.trim(),
      pieces: selectedPieces
    })

    wx.showToast({ title: '已保存穿搭', icon: 'success' })
    wx.navigateBack()
  },

  goBack() {
    wx.navigateBack()
  }
})