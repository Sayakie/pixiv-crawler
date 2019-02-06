import fs from 'fs'
import request from 'request'
import * as cheerio from 'cheerio'

const EMPTY = ''

type Payload = request.CoreOptions & (request.UrlOptions | request.UriOptions)

type HTML = string

interface CheerioOptions {
  xmlMode?: boolean
  decodeEntities?: boolean
  lowerCaseTags?: boolean
  lowerCaseAttributeNames?: boolean
  recognizeCDATA?: boolean
  recognizeSelfClosing?: boolean
  normalizeWhitespace?: boolean
  ignoreWhitespace?: boolean
}

interface LinkOptions {
  type: string
  name: string
  attribs: {
    href: string
    class: string
    target: string
    src: string
    alt: string
    title: string
    border: string
  }
  children: any
  next: string | null
  prev: string | null
  parent: LinkOptions
}

class App {
  private readonly originUrl = 'https://www.pixiv.net'
  private readonly requestUrl = `${this.originUrl}/ranking.php?mode=daily&content=illust&p=1`
  private static instance: App
  public static readonly getInstance = () => {
    if (!App.instance) {
      return new App()
    }

    return App.instance
  }

  private static get payload(): request.CoreOptions {
    return {
      gzip: true,
      json: true,
      headers: {
        'User-Agent': 'Sayakie-request-bot',
        referer: 'https://www.pixiv.net',
      },
    }
  }

  private readonly request = async (payload: Payload): Promise<string> => {
    return new Promise(
      (resolve, reject): void => {
        request(payload, (error, _, body) => (error ? reject(error) : resolve(body)))
      },
    )
  }

  public readonly start = async () => {
    await this.initialise()
      .then(raw => this.trim(raw))
      .catch(console.error)
  }

  private readonly initialise = async () => {
    const url: string = this.requestUrl
    const payload: Payload = { ...App.payload, url }

    return await this.request(payload)
  }

  private readonly trim = async (raw: HTML) => {
    const $options: CheerioOptions = {
      xmlMode: true,
    }
    const $ = cheerio.load(raw, $options)

    const pixivContainer = '.ranking-items'
    const pixivItemLink = '.ranking-image-item > a'
    await $(pixivContainer).map((_index, pixivItems) => {
      const Links = $(pixivItems)
        .find(pixivItemLink)
        .get()

      Links.map(async (link: LinkOptions) => {
        const url: string = `${this.originUrl}${link.attribs.href}`
        const payload: Payload = { ...App.payload, url }

        const raw = await this.request(payload)
        this.extract(raw)
      })
    })
  }

  private readonly extract = (raw: HTML) => {
    const $options: CheerioOptions = {
      xmlMode: true,
    }
    const $ = cheerio.load(raw, $options)

    const pixivImgContainer = '.img-container > a > img'
    const pixivImg = $(pixivImgContainer).get()

    pixivImg.map((node: LinkOptions) => {
      const imgUrl: string = node.attribs.src.replace(/c\/600x600\//, EMPTY)
      const imgName = imgUrl.split('/')[11].split('_')[0]
      const imgExt = imgUrl.slice(-3)
      const payload = { ...App.payload, url: imgUrl, encoding: null }

      this.request(payload)
        .then(response => Buffer.from(response, 'binary').toString('base64'))
        .then(response => fs.writeFile(`images/${imgName}.${imgExt}`, response, 'base64', console.error))
        .catch(console.error)
    })
  }
}

export default App
