import fs from "fs";
import request from "request";
import * as cheerio from "cheerio";

export const Pixiv = {
  async crawl() {
    const payload = getPayload(RequestUrl);
    const body = await startGetRequest(payload);
    const imageLinkList = extractImageLinksList(body);

    const getImageBody = (imageLink: string) => {
      const url = OriginalUrl + imageLink;
      const payload = getPayload(url);
      return startGetRequest(payload);
    };

    const imageBodyList = await Promise.all(imageLinkList.map(getImageBody));
    const imageList = (await Promise.all(
      imageBodyList.map(extractImageList)
    )).reduce(flatList);

    const Encoding = "base64";
    imageList.forEach(async ({ url, name }) => {
      const payload = getPayload(url);
      const image = await startGetRequest(payload);
      fs.writeFile(
        name,
        Buffer.from(image, "binary").toString(Encoding),
        Encoding,
        console.error
      );
    });
  }
};

const flatList = (itemList: any[], currentItemList: any[]) =>
  itemList.concat(currentItemList);

type Payload = request.CoreOptions & (request.UrlOptions | request.UriOptions);

type HTML = string;

interface LinkOptions {
  readonly attribs: {
    readonly href: string;
    readonly src: string;
  };
}

const OriginalUrl = "https://www.pixiv.net";

const RequestUrl = `${OriginalUrl}/ranking.php?mode=daily&content=illust&p=1`;

const getPayload = (url: string) => ({
  gzip: true,
  json: true,
  url,
  encoding: null,
  headers: {
    "User-Agent": "Sayakie-request-bot",
    referer: OriginalUrl
  }
});

const startGetRequest = (payload: Payload) =>
  new Promise<HTML>((resolve, reject) => {
    request.get(payload, (error, _, body: HTML) =>
      error ? reject(error) : resolve(body)
    );
  });

const extractImageLinksList = (body: HTML): string[] => {
  const $ = cheerio.load(body, { xmlMode: true });
  const PixivContainer = ".ranking-items";
  const PixivItemLink = ".ranking-image-item > a";

  const reduceLinkList = (pixivItems: CheerioElement) => {
    const linkList = $(pixivItems)
      .find(PixivItemLink)
      .get();
    const extractLink = (options: LinkOptions) => options.attribs.href;
    return linkList.map(extractLink);
  };

  const flatList = (linkList: string[], items: string[]) =>
    linkList.concat(items);

  const imageLinkList = $(PixivContainer)
    .toArray()
    .map(reduceLinkList)
    .reduce(flatList, []);
  return imageLinkList;
};

const extractImageList = async (body: HTML) => {
  const $ = cheerio.load(body, { xmlMode: true });
  const PixivImageContainer = ".img-container > a > img";
  const pixivImageList = $(PixivImageContainer).get();
  const ResolutionPattern = /c\/600x600\//;
  return pixivImageList.map((options: LinkOptions) => {
    const imageUrl = options.attribs.src.replace(ResolutionPattern, "");
    const imageName = imageUrl.split("/")[11].split("_")[0];
    const imageExtension = imageUrl.slice(-3);
    return {
      url: imageUrl,
      name: `images/${imageName}.${imageExtension}`
    };
  });
};
