const config = require("../config/index");
const { curly } = require("node-libcurl");
const xml2js = require("xml2js");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

const parseFeed = (feed) => {
  return new Promise((resolve, reject) => {
    parser.parseString(feed, (err, result) => {
      if (err) {
        return reject(err);
      } else {
        const entries = result["rss"]["channel"][0]["item"] || [];
        const simplifiedEntries = (entries || []).map((entry) => ({
          title: entry.title[0],
          pubDate: entry.pubDate[0],
          description: entry.description[0],
          link: entry.link[0],
        }));
        return resolve(simplifiedEntries);
      }
    });
  });
};

const getArticlesFromHtml = (html, config) => {
  const articles = [];
  const $ = cheerio.load(html);
  $(config.container).each((i, ele) => {
    const article = {};
    article.title = $(ele).find(config.header).text().trim();
    article.link = $(ele).find(config.link).attr("href");
    article.date = $(ele).find(config.date).text().trim();
    if (article.date) {
      article.date = new Date(article.date).toISOString();
    } else {
      article.date = new Date().toISOString();
    }
    article.description = $(ele).find(config.description).text().trim();
    articles.push(article);
  });
  return articles;
};

const fetchArticlesFromUrl = async (url, config) => {
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction(
    "window.performance.timing.loadEventEnd - window.performance.timing.navigationStart >= 500"
  );
  const pageSourceHTML = await page.content();
  await browser.close();
  return getArticlesFromHtml(pageSourceHTML, config);
};

const fetchData = async (configQuery, jsLoad = true) => {
  const blogs = config[configQuery];
  const blogPromises = blogs.map(async (rss) => {
    const url = rss["rssUrl"] || rss["blogUrl"];
    if (rss["rssUrl"]) {
      const { statusCode, data } = await curly.get(url);
      const feedData = data.toString();
      if (statusCode !== 200) return [];
      return parseFeed(feedData);
    } else {
      const data = jsLoad
        ? await fetchArticlesFromUrl(url, rss)
        : await curly.get(url);
      return data;
    }
  });
  const blogJsonData = await Promise.all(blogPromises);
  const entries = (blogJsonData || [])
    .filter(Boolean)
    .reduce((p, c) => (p = p.concat(c)), []);

  return entries;
};

const convertEntriesToRss = (blog, entries) => {
  const rssFeed = {
    rss: {
      channel: {
        title: blog,
        link: `www.example.com`,
        description: `feed for ${blog}`,
        item: entries,
      },
    },
  };
  const rssXml = builder.buildObject(rssFeed);
  return rssXml;
};

module.exports = { fetchData, convertEntriesToRss };
