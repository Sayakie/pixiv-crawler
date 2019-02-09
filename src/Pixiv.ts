import fs from 'fs'
import request from 'request'

type Payload = request.Options
type Content = 'illust' | 'ugoira' | 'manga'

export interface crawlOptions {
  readonly parseMode?: Mode
  readonly parseScope?: number | 'auto'
  readonly forceOverwrite?: boolean
  readonly saveDir?: string
}

interface itemList {
  readonly url: string
  readonly name: string
}

interface illustType {
  readonly antisocial: boolean
  readonly bl: boolean
  readonly drug: boolean
  readonly furry: boolean
  readonly grotesque: boolean
  readonly homosexual: boolean
  readonly lo: boolean
  readonly original: boolean
  readonly religion: boolean
  readonly sexual: boolean
  readonly thoughts: boolean
  readonly violent: boolean
  readonly yuri: boolean
}

interface Contents {
  readonly title: string
  readonly date: string
  readonly tags: string[]
  readonly url: string
  readonly illust_id: number
  readonly illust_content_type: illustType
  readonly iilust_series: boolean
  readonly iilust_type: string | number
  readonly illust_upload_timestamp: boolean
  readonly user_id: number
  readonly user_name: string
  readonly width: number
  readonly height: number
}

interface PixivAPI {
  readonly content: Content
  readonly contents: Contents[]
  readonly mode: Mode
  readonly date: string
  readonly page: number
  readonly prev: number
  readonly prev_date: string | boolean
  readonly next: number
  readonly next_date: string | boolean
  readonly rank_total: number
}

interface Url {
  url: string
}

export const enum Mode {
  Daily = 'daily',
  Weekly = 'weekly',
  Montly = 'monthly',
  Rookie = 'rookie'
}

const OriginalUrl = 'https://www.pixiv.net'

const ResolutionPattern = /c\/\d{3,4}x\d{3,4}\//
const MasteringPattern = /\/img-master\//
const OriginalPattern = /img-original/
const UselessBackStr = /_master1200/

const defaultCrawlOptions: crawlOptions = {
  parseMode: Mode.Daily,
  parseScope: 'auto',
  forceOverwrite: false,
  saveDir: 'images'
}

export const Pixiv = {
  async crawl(customOptions?: crawlOptions) {
    const options = concatOptions(customOptions)
    const RequestUrl = `${OriginalUrl}/ranking.php?format=json&content=illust&mode=${options.parseMode}`
    const payload = getPayload(RequestUrl)
    const artworkCounts = await getArtworks(payload)

    const getRequestUrls = () => {
      const requestUrls = []
      const totalRequestCounts = Math.ceil(artworkCounts / 50)

      for (let requestCount = 1; requestCount < totalRequestCounts; requestCount++) {
        requestUrls.push(`${RequestUrl}&p=${requestCount}`)
      }

      return requestUrls
    }
    const requestUrls = getRequestUrls()
    const imageList: itemList[] = (await Promise.all(requestUrls.map(extractImageList))).reduce(flatList)

    const Encoding = 'base64'
    imageList.forEach(async ({ url, name }: itemList) => {
      const file = `${options.saveDir}/${name}`

      if (fs.existsSync(file)) {
        console.log(`Skip to download: ${name}`)
        return
      }

      const payload = getPayload(url)
      const image: string = await startGetRequest(payload)

      console.log(`Download: ${name}`)
      fs.writeFile(file, Buffer.from(image, 'binary').toString(Encoding), Encoding, console.error)
    })
  }
}

const concatOptions = (customOptions: crawlOptions = {}) => Object.assign(defaultCrawlOptions, customOptions)

const getPayload = (url: string) => ({
  gzip: true,
  json: true,
  url,
  encoding: null,
  headers: {
    'User-Agent': 'Sayakie-request-bot',
    referer: OriginalUrl
  }
})

const extractImageList = async (requestUrl: string) => {
  const payload = getPayload(requestUrl)
  const imageList: PixivAPI = await startGetRequest(payload)

  const extractImage = ({ url }: Contents): itemList => {
    const imageUrl = url.replace(ResolutionPattern, '')
    const imageName = imageUrl.split('/')[11].split('_')[0]
    const imageExtension = imageUrl.slice(-3)

    return {
      url: imageUrl,
      name: `${imageName}.${imageExtension}`
    }
  }

  return imageList.contents.map(extractImage)
}

const getArtworks = (payload: Payload) => startGetRequest(payload).then(({ rank_total }: PixivAPI) => rank_total)

const flatList = (itemList: itemList[], currentItemList: itemList[]) => itemList.concat(currentItemList)

const startGetRequest = (payload: Payload) =>
  new Promise<any>((resolve, reject) => {
    request.get(payload, (error, { statusCode }, body) => {
      error || statusCode !== 200 ? reject(error) : resolve(body)
    })
  })
