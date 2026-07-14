const privacySections = [
  {
    title: '我们收集什么',
    body: '本小程序用于个人衣橱记录。你主动填写或选择的衣物图片、名称、分类、价格、颜色、季节、场合、购买日期、状态、备注、穿搭、愿望清单和穿着记录会用于本机展示和统计。'
  },
  {
    title: '数据保存在哪里',
    body: '当前版本不使用服务器账号体系，数据主要保存在本机微信小程序缓存中。复制备份和恢复备份均由你主动操作。'
  },
  {
    title: '是否上传服务器',
    body: '当前版本不主动上传衣物图片、价格、备注或穿着记录到开发者服务器，也不提供公开发布、交易或社交功能。'
  },
  {
    title: '如何删除数据',
    body: '你可以在设置页使用清空本地数据功能，也可以在微信中清理本小程序缓存。删除后如没有备份，数据无法恢复。'
  },
  {
    title: '权限说明',
    body: '选择衣物图片时会使用微信提供的图片选择能力；复制备份时会使用剪贴板能力。相关操作均由你主动触发。'
  }
]

const agreementSections = [
  {
    title: '使用范围',
    body: '本小程序是个人衣橱管理工具，用于记录衣物、穿搭、愿望清单和穿着统计。请勿用于违法违规或侵犯他人权益的用途。'
  },
  {
    title: '本地数据责任',
    body: '当前版本数据主要保存在本机。更换设备、清理缓存、卸载小程序可能造成数据丢失，请自行保存备份。'
  },
  {
    title: '内容责任',
    body: '你在小程序中上传或填写的图片、备注和其他内容由你自行管理，请确保拥有相应使用权。'
  },
  {
    title: '功能变更',
    body: '后续版本可能调整统计、备份、数据字段和页面功能。正式发布时会根据实际能力更新说明。'
  }
]

Page({
  data: {
    title: '',
    sections: []
  },

  onLoad(options) {
    const isAgreement = options.type === 'agreement'
    const title = isAgreement ? '用户协议' : '隐私政策'
    this.setData({
      title,
      sections: isAgreement ? agreementSections : privacySections
    })
    wx.setNavigationBarTitle({ title })
  }
})
