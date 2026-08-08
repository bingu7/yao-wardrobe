// 迁移/兼容性测试共享的 wx mock（精简自 wardrobe.test.js）
const store = new Map()
const removedFiles = []
const unlinkedFiles = []
const fileContents = new Map()
let mkdirShouldReportExisting = false

global.wx = {
  env: { USER_DATA_PATH: 'wxfile://usr' },
  getDeviceInfo() { return { platform: '' } },
  getStorageSync(key) { return store.get(key) },
  setStorageSync(key, value) { store.set(key, value) },
  saveFile(options) { options.success({ savedFilePath: `saved://${options.tempFilePath}` }) },
  getSavedFileList(options) {
    options.success({ fileList: [{ filePath: 'saved://old' }, { filePath: 'saved://temp-new' }] })
  },
  removeSavedFile(options) { removedFiles.push(options.filePath) },
  getFileSystemManager() {
    return {
      mkdir(options) {
        if (mkdirShouldReportExisting) {
          options.fail({ errMsg: `mkdir:fail file already exists ${options.dirPath}`, errno: 1301005 })
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
        // 模拟微信真机：base64 编码写入时，非法 base64 会失败
        if (options.encoding === 'base64') {
          try {
            const buf = Buffer.from(String(options.data || ''), 'base64')
            if (buf.length === 0 || String(options.data || '').replace(/\s/g, '') !== buf.toString('base64').replace(/\s/g, '')) {
              options.fail({ errMsg: 'writeFile:fail invalid data' })
              return
            }
          } catch (error) {
            if (options.fail) options.fail({ errMsg: 'writeFile:fail invalid data' })
            return
          }
        }
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
  showToast() {},
  showModal() {},
  showLoading() {},
  hideLoading() {}
}

const wardrobe = require('../utils/wardrobe')

function resetStorage() {
  store.clear()
  removedFiles.length = 0
  unlinkedFiles.length = 0
  fileContents.clear()
  mkdirShouldReportExisting = false
  store.set('privateWardrobeCategoriesManaged', true)
  store.set('privateWardrobeCustomCategories', ['上衣', '下装', '其他'])
  store.set('privateWardrobeOccasionsManaged', true)
  store.set('privateWardrobeCustomOccasions', ['通勤', '旅行'])
}

module.exports = { store, removedFiles, unlinkedFiles, fileContents, wardrobe, resetStorage, get mkdirShouldReportExisting() { return mkdirShouldReportExisting }, set mkdirShouldReportExisting(v) { mkdirShouldReportExisting = v } }
