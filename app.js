App({
  globalData: {},
  onHide() {
    // 记录退后台时间，页面用它区分“切走 tab”与“程序退后台”（add 页保留编辑会话用）
    this.globalData.backgroundedAt = Date.now()
  }
})
