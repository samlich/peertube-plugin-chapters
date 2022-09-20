import type { RegisterServerOptions, MVideoFullLight, VideoDetails, PluginStorageManager } from '@peertube/peertube-types'
import { Request, Response } from 'express'
import short from 'short-uuid'
import { tableOfContentsField, parseTableOfContents, toWebVtt, Chapters, migrateTags, tagsCompatibility, hasOwn } from '../shared/common'

const shortUuidTranslator = short()

export async function register ({ peertubeHelpers, registerHook, storageManager: storageManager_, getRouter }: RegisterServerOptions): Promise<void> {
  const log = peertubeHelpers.logger
  const storageManager = new StorageManagerTypeFix(storageManager_)

  registerHook({
    target: 'action:api.video.updated',
    handler: async ({ video, body }: { video: MVideoFullLight, body: any }) => {
      if (body.pluginData == null) {
        return
      }

      let tocText = body.pluginData[tableOfContentsField]
      if (tocText == null) {
        return
      }

      if (tocText === '') {
        tocText = null
      }
      await storageManager.storeDataString(tocTextStore(video.id), tocText)

      let parsed = parseTableOfContents(tocText)
      if (!hasOwn(parsed, 'error')) {
        parsed = parsed as Chapters
        await storageManager.storeDataObjectRaw(tocParsedStore(video.id), parsed)
        if (parsed.chapters.length === 0) {
          await storageManager.storeDataRemove(tocWebVttStore(video.id))
        } else {
          const webVtt = toWebVtt(parsed)
          await storageManager.storeDataString(tocWebVttStore(video.id), webVtt)
        }
      } else {
        await storageManager.storeDataRemove(tocParsedStore(video.id))
        await storageManager.storeDataRemove(tocWebVttStore(video.id))
      }
    }
  })

  registerHook({
    target: 'filter:api.video.get.result',
    handler: async (video: VideoDetails | null) => {
      if (video == null) {
        return video
      }
      if (video.pluginData == null) {
        video.pluginData = {}
      }

      video.pluginData[tableOfContentsField] = await storageManager.getDataString(tocTextStore(video.id.toString()))
      const chaptersUnconverted = await storageManager.getDataObjectRaw(tocParsedStore(video.id.toString()))
      if (chaptersUnconverted !== undefined) {
        const chapters = migrateTags(chaptersUnconverted)[0]
        if (chapters != null) {
          tagsCompatibility(chapters)
          video.pluginData[tableOfContentsField + '_parsed'] = chapters
        }
      }
      return video
    }
  })

  // needed until Express 5, when promises are supported
  // https://thecodebarbarian.com/using-async-await-with-mocha-express-and-mongoose.html
  // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/50871
  function wrapExpressAsync (fn: (req: Request, res: Response) => Promise<void>): (req: Request, res: Response, next: any) => void {
    return function (req: Request, res: Response, next: any): void {
      fn(req, res).catch(next)
    }
  }

  const router = getRouter()
  router.get('/videos/*', wrapExpressAsync(getVideo))
  router.get('/api/v1/videos/*', wrapExpressAsync(getVideo))

  async function getVideo (req: Request, res: Response): Promise<void> {
    const file = req.path.slice(req.path.lastIndexOf('/') + 1)
    const extensionIndex = file.indexOf('.')
    let extension = 'vtt'
    let videoIdOrUUID = file
    if (extensionIndex !== -1) {
      videoIdOrUUID = file.slice(0, extensionIndex)
      extension = file.slice(extensionIndex + 1)
    }
    let videoId = videoIdOrUUID
    // the short UUIDs appear to be 22, but are allowed to be shorter, so use 13 to be safe
    if (videoIdOrUUID.length >= 13) {
      try {
        if (!videoIdOrUUID.includes('-')) {
          videoIdOrUUID = shortUuidTranslator.toUUID(videoIdOrUUID)
        }
        const video = await peertubeHelpers.videos.loadByIdOrUUID(videoIdOrUUID)
        if (video == null) {
          res.status(404).send('404 Not Found')
          return
        }
        videoId = video.id
      } catch (e) {
        log.error(`chapters: /videos/: Failed to video loadByIdOrUUID: ${String(e)}`)
        res.status(500).send('500 Internal Server Error')
        return
      }
    }

    switch (extension) {
      case 'vtt': {
        const webVtt = await storageManager.getDataString(tocWebVttStore(videoId))

        if (webVtt == null) {
          res.status(404).send('404 Not Found')
        } else {
          res.append('content-type', 'text/vtt')
          res.send(webVtt)
        }
        break
      }
      case 'json': {
        const json = await storageManager.getDataObjectRaw(tocParsedStore(videoId))

        if (json == null) {
          res.status(404).send('404 Not Found')
        } else {
          const chapters = migrateTags(json)[0]
          res.append('content-type', 'application/json')
          res.send(chapters)
        }
        break
      }
      default: {
        res.status(404).send('404 Not Found')
      }
    }
  }
}

export async function unregister (): Promise<void> {
}

interface StoreKey<T> {
  k: string
  _phantom: (_x: T) => void
}
const phantomData = function<T>(_x: T): void {}
interface StoreObjectKey<T> {
  k: string
  validate: (x: object) => T | null
}

function tocTextStore (videoId: string): StoreKey<string> {
  return { k: tableOfContentsField + '_v-' + videoId, _phantom: phantomData }
}
// may store older `Chapters` objects. `migrateTags` handles validation and conversion
function tocParsedStore (videoId: string): StoreKey<object> {
  return { k: tableOfContentsField + '_parsed' + '_v-' + videoId, _phantom: phantomData }
}
function tocWebVttStore (videoId: string): StoreKey<string> {
  return { k: tableOfContentsField + '_vtt' + '_v-' + videoId, _phantom: phantomData }
}

class StorageManagerTypeFix {
  storageManager: PluginStorageManager

  constructor (storageManager: PluginStorageManager) {
    this.storageManager = storageManager
  }

  // PeerTube lies and says it will always return a string, when it actually
  // returns undefined when no value exists, and returns an object, number, string, boolean, or null
  // if it's able to parse as json
  async getDataUnknown (key: string): Promise<object | number | string | boolean | null | undefined> {
    // PeerTube spec specifies: async getData (key: string): Promise<string> {
    return await this.storageManager.getData(key) as any
  }

  async getDataString (key: StoreKey<string>): Promise<string | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || typeof val === 'string') {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    return JSON.stringify(val)
  }

  async getDataObjectRaw (key: StoreKey<object>): Promise<object | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || (typeof val === 'object' && val != null)) {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error('expected object for stored value ' + key.k + ', but got ' + typeof val)
  }

  async getDataObject<T> (key: StoreObjectKey<T>): Promise<T | null | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined) {
      return val
    }
    if (typeof val === 'object' && val != null) {
      return key.validate(val)
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error(`expected object for stored value ${key.k}, but got ${typeof val} with nullness: ${(val === null).toString()}`)
  }

  async getDataNumber (key: StoreKey<number>): Promise<number | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || typeof val === 'number') {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error('expected number for stored value ' + key.k + ', but got ' + typeof val)
  }

  async getDataBoolean (key: StoreKey<boolean>): Promise<boolean | undefined> {
    const val = await this.getDataUnknown(key.k)
    if (val === undefined || typeof val === 'boolean') {
      return val
    }
    // backwards compatibility for when we set values to null in order to unset them
    if (val === null) {
      return undefined
    }
    throw new Error('expected boolean for stored value ' + key.k + ', but got ' + typeof val)
  }

  /* async storeData (key: string, data: any): Promise<any> {
    return await this.storageManager.storeData(key, data)
  } */

  async storeDataRemove<T> (key: StoreKey<T>): Promise<any> {
    return await this.storageManager.storeData(key.k, undefined)
  }

  async storeDataString (key: StoreKey<string>, data: string): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }

  async storeDataObjectRaw (key: StoreKey<object>, data: object): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }

  async storeDataObject<T> (key: StoreObjectKey<T>, data: T): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }

  async storeDataNumber (key: StoreKey<number>, data: number): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }

  async storeDataBoolean (key: StoreKey<boolean>, data: boolean): Promise<void> {
    await this.storageManager.storeData(key.k, data)
  }
}
