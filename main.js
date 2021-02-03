const common = require('./client/common.js')
const { version, tableOfContentsField, parseTableOfContents, toWebVtt } = common

async function register ({registerHook, registerSetting, settingsManager, storageManager, videoCategoryManager, videoLicenceManager, videoLanguageManager, getRouter}) {
  registerHook({
    target: 'action:api.video.updated',
    handler: ({ video, body }) => {
      if (!body.pluginData) {
        return
      }

      var tocText = body.pluginData[tableOfContentsField]
      if (!tocText) {
        return
      }

      if (tocText === '') {
        tocText = null
      }
      storageManager.storeData(tableOfContentsField + '_v-' + video.id, tocText)

      const parsed = parseTableOfContents(tocText)
      if (parsed.errorString == null) {
        storageManager.storeData(tableOfContentsField + '_parsed' + '_v-' + video.id, parsed)
        if (parsed.chapters.length == 0) {
          storageManager.storeData(tableOfContentsField + '_vtt' + '_v-' + video.id, null)
        }else {
          const webVtt = toWebVtt(parsed)
          storageManager.storeData(tableOfContentsField + '_vtt' + '_v-' + video.id, webVtt)
        }
      }else {
        webVttstorageManager.storeData(tableOfContentsField + '_parsed' + '_v-' + video.id, null)
        webVttstorageManager.storeData(tableOfContentsField + '_vtt' + '_v-' + video.id, null)
      }
    }
  })

  registerHook({
    target: 'filter:api.video.get.result',
    handler: async (video) => {
      if (!video) {
        return video
      }
      if (!video.pluginData) {
        video.pluginData = {}
      }

      video.pluginData[tableOfContentsField] = await storageManager.getData(tableOfContentsField + '_v-' + video.id)
      video.pluginData[tableOfContentsField + '_parsed'] = await storageManager.getData(tableOfContentsField + '_parsed' + '_v-' + video.id)
      return video
    }
  })

  const router = getRouter()
  router.get('/videos/*', async (req, res) => {
    const videoId = req.path.slice(req.path.lastIndexOf('/') + 1)
    const webVtt = await storageManager.getData(tableOfContentsField + '_vtt' + '_v-' + videoId)

    if (webVtt == null) {
      res.status(404).send('404 Not Found')
    }else {
      res.append('content-type', 'text/vtt')
      res.send(webVtt)
    }
  })
}

async function unregister () {
}

module.exports = {
  register,
unregister}
