const config = require("../config/index");
const blogRegex = require("../config/regex");
const axios = require("axios");
const xml2js = require("xml2js");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const parser = new xml2js.Parser();
const { writeToFile } = require("../utils/fileUtils");
const { convertEntriesToRss, convertFeedToJson } = require("../utils/feed");
const { applicationLogger: LOG } = require("./logger");
const { isWithInHours, curlChildProcess } = require("./utils");
const { marketCodes } = require("./market");
const marketData = require("./../data/market.json");
const { filterPostsWithAI } = require("./aiFilter");

const isMarketMatched = (post)=>{
  const pattern = new RegExp(`(${marketCodes.join('|')}):\\s*(\\S+)`, 'i')
  const isMatched = JSON.stringify(post).match(pattern);
  if(isMatched && isMatched.length > 2){
    const codeSymbol = isMatched[2].replaceAll(/[^a-zA-Z0-9]/g, "");
    // 1 billion market cap
    return marketData.findIndex((m)=>m.symbol.toUpperCase() == codeSymbol.trim().toUpperCase() && m.marketCap > 1000000000) !== -1;
  }
  return true
}

const isPostFiltered = (post, blogName) => {
  if (!post) return;
  if (!isWithInHours(post.date, 1)) return;
  const regex = blogRegex[blogName];
  const excludeTitle = regex?.exclude ? !post.title.match(regex.exclude) : true;
  const includePost = regex?.include
    ? JSON.stringify(post).match(regex.include)
    : true;
  const marketMatched = isMarketMatched(post);
  if (includePost && excludeTitle && marketMatched) return post;
};

const loadDataBy = {
  puppeteer: "puppeteer",
  axios: "axios",
  barrons: "barrons",
  accesswire: "accesswire",
  reuters: "reuters"
};

const createRetryPromise = (asyncFunction, maxRetries = 3, delayMs = 100) => {
  return new Promise(async (resolve, reject) => {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const result = await asyncFunction();
        resolve(result);
        return;
      } catch (error) {
        console.error(`Attempt ${retries + 1} failed: ${error.message}`);
        retries++;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    reject(
      new Error(
        `Max retries (${maxRetries}) reached. Unable to complete operation.`,
        asyncFunction,
      ),
    );
  });
};

const parseFeed = (feed) => {
  return new Promise((resolve) => {
    if (Array.isArray(feed)) return resolve(feed);
    parser.parseString(feed, (err, result) => {
      const entries =
        result?.["rss"]?.["channel"]?.[0]?.["item"] || result?.urlset?.url;
      if (err) {
        return result || feed;
      }
      if (!entries) return resolve([]);
      const simplifiedEntries = (entries || []).reduce((prev, entry) => {
        const link = entry.link?.[0] || entry.loc?.[0];
        if (entry["news:news"]) {
          entry = entry["news:news"][0];
        }
        const pubDate =
          entry.pubDate?.[0] ||
          entry.date?.[0] ||
          entry["news:publication_date"]?.[0];
        const title = entry.title?.[0] || entry["news:title"]?.[0];
        if (!link || !pubDate || !title) return prev;
        // filter all posts older than 1 hours
        const date = new Date(String(pubDate)).getTime();
        const description =
          entry?.description?.[0] || entry?.content?.[0] || title;
        const post = {
          title: title.replace(/<\/?[^>]+(>|$)/g, ""),
          date,
          description: description.replace(/<\/?[^>]+(>|$)/g, ""),
          link,
        };
        prev.push(post);
        return prev;
      }, []);
      return resolve(simplifiedEntries);
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
    if (article.date && !article?.date?.toLowerCase()?.includes("updated")) {
      if (article.date.toLowerCase().includes("ago")) {
        article.date = article.date.replace("ago", "");
        article.date = new Date(article.date.trim()).getTime();
      }
      if (article.date.toLowerCase().includes("et")) {
        const monthToNumber = (month)=> {
          const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          return months.indexOf(month.toLowerCase());
        }        
        const dateString = article.date;
        const dateParts = dateString.split(" "); // Split by spaces
        const month = dateParts[0]; // "March"
        const day = parseInt(dateParts[1]); // 20
        const year = parseInt(dateParts[2]); // 2024
        const time = dateParts[3]; // "4:19"
        const meridiem = dateParts[4]; // "pm"
        let [hour, minute] = time.split(":").map(Number);
        if (meridiem === "pm" && hour !== 12) {
          hour += 12; // Convert to 24-hour format
        }
        
        article.date = new Date(year, monthToNumber(month), day, hour, minute);
        if( dateParts[5] &&  dateParts[5].toLowerCase() === "et"){
          const etOffset = -4; // Eastern Time (ET) offset in hours
          article.date.setHours(article.date.getHours() + etOffset);
        }
        article.date = article.date.getTime();
      }
      
    } else {
      article.date = new Date().getTime();
    }
    article.description = $(ele).find(config.description).text().trim();
    articles.push(article);
  });
  return articles;
};

const fetchArticlesFromPuppeter = async (url, config) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await page.waitForFunction(
      "window.performance.timing.loadEventEnd - window.performance.timing.navigationStart >= 500",
    );
    await page.waitForSelector(config.container);
    const pageSourceHTML = await page.content();
    return getArticlesFromHtml(pageSourceHTML, config);
  } catch (e) {
    throw e;
  } finally {
    await browser.close();
  }
};

const waitFor = (timer) => {
  return new Promise((resolve) => {
    setTimeout(resolve, timer);
  });
};



const fetchArticlesForBarrons = async (url, config) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, */*'
      }
    });
    
    // Parse the RSS/XML feed
    const parsedData = await parseFeed(data);
    
    // Filter by stock_tickers count (exactly 1)
    const filteredArticles = parsedData.filter((article) => {
      // Parse the original XML to get stock_tickers
      return new Promise((resolve) => {
        parser.parseString(data, (err, result) => {
          if (err) return resolve(false);
          const entries = result?.urlset?.url || [];
          const entry = entries.find(e => {
            const link = e.loc?.[0];
            return link === article.link;
          });
          
          if (!entry || !entry["news:news"]) return resolve(false);
          
          const stockTickers = entry["news:news"][0]["news:stock_tickers"]?.[0];
          if (!stockTickers) return resolve(false);
          
          const tickerCount = stockTickers.split(',').filter(Boolean).length;
          resolve(tickerCount === 1);
        });
      });
    });
    
    // Wait for all filter promises to resolve
    const results = await Promise.all(
      parsedData.map(async (article) => {
        return new Promise((resolve) => {
          parser.parseString(data, (err, result) => {
            if (err) return resolve(null);
            const entries = result?.urlset?.url || [];
            const entry = entries.find(e => {
              const link = e.loc?.[0];
              return link === article.link;
            });
            
            if (!entry || !entry["news:news"]) return resolve(null);
            
            const stockTickers = entry["news:news"][0]["news:stock_tickers"]?.[0];
            if (!stockTickers) return resolve(null);
            
            const tickerCount = stockTickers.split(',').filter(Boolean).length;
            if (tickerCount === 1) {
              return resolve(article);
            }
            resolve(null);
          });
        });
      })
    );
    
    return results.filter(Boolean);
  } catch (error) {
    LOG.error(`Barron's fetch failed: ${error.message}`);
    return [];
  }
}

const fetchArticlesForAccessWire = async (url, config) => {
  const curlCommand = `curl 'https://www.accesswire.com/public/newsroom' \
  -X 'POST' \
  -H 'authority: www.accesswire.com' \
  -H 'accept: */*' \
  -H 'accept-language: en-US,en;q=0.9' \
  -H 'account: 1' \
  -H 'content-length: 0' \
  -H 'cookie: __ctmid=65d04d6f00028b352f9d0bf0; __ctmid=65d04d6f00028b352f9d0bf0; _gcl_au=1.1.232772572.1708150128; hubspotutk=b364064a5af9f38d6d9d86b78837df1e; messagesUtk=54cbfc1540144bfba56ba6fdec914ee5; ads__landing_url__c=https%3A%2F%2Fwww.accesswire.com%2Fnewsroom; ads__referral_url__c=https%3A%2F%2Fwww.accesswire.com%2Fnewsroom; __hssrc=1; .AspNetCore.Antiforgery.yHDs6zQR-IY=CfDJ8Lh9PTP6ATdHgVQiR28b-92TTL15rceBx_5TWRNJDXUWnXIIoMYyaSp4Ei-6VrGRWkZbmr563JXK27t_Hcf2imMToDxLhVdIiTnF6r12pQeHGDjkS8gbRR0gMV0j5l6CgjJsnMSxcjZiLSkLHDCm-ww; _gid=GA1.2.1964757776.1710710224; ads__geoip=country%3DUnited%2520States%26city%3DAustin%26latitude%3D30.2428%26longitude%3D-97.7658; __hstc=117828950.b364064a5af9f38d6d9d86b78837df1e.1708150128794.1710259896807.1710710224238.14; _gat=1; _ga=GA1.1.1058342375.1708150128; _ga_K04P53QQQB=GS1.2.1710710223.14.1.1710710780.60.0.0; __hssc=117828950.2.1710710224238; _ga_LZSJWCFSJY=GS1.1.1710710223.16.1.1710710792.47.0.0' \
  -H 'origin: https://www.accesswire.com' \
  -H 'referer: https://www.accesswire.com/newsroom' \
  -H 'sec-ch-ua: "Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' \
  -H 'x-csrf-token-headername: CfDJ8Lh9PTP6ATdHgVQiR28b-90p6GeoB1yXutfnTVJqJOrGUSzMeG-t2V7po9EbRLgcof7hOOzlXD-Bm29C7ipK47V15c6VRSbSigD2wWwbQgBhy396wmHndIJxvH0MfJpbyXUEjJIanbevTiQunx4twXE'`
  let articles = [];
  try {
    const data = await curlChildProcess(curlCommand)
    const jsonData = JSON.parse(data);
    articles = (jsonData?.data?.articles || []).map((article)=>{
      return {
        title: article.title,
        description: article.body.replace(/<\/?[^>]+(>|$)/g, ""),
        date: article.adate || article.dateString,
        link: article.releaseurl
      }
    })
  } finally {
    return articles;
  }

}

const fetchArticlesForReuters = async (url, config) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.reuters.com/markets/',
      }
    });
    return (data?.result?.articles || []).map((post) => {
      post.date = post.published_time;
      post.link = `https://www.reuters.com${post.canonical_url}`
      return post
    })
  } catch (error) {
    // Reuters has bot protection, return empty array on failure
    LOG.error(`Reuters fetch failed (likely bot protection): ${error.message}`);
    return [];
  }
}

const fetchEntries = async (blogName, enableAI = false) => {
  const blogs = config[blogName];
  if (!blogs?.length) return [];
  let currentLoadType = loadDataBy.axios;
  const fetchBlogData = async (rss) => {
    if (rss["loadType"]) {
      currentLoadType = rss["loadType"];
    }
    const url = rss["blogUrl"];
    LOG.info(
      "Fetching data for " +
      blogName +
      " from " +
      url +
      " using load type " +
      currentLoadType,
    );
    try {
      if (currentLoadType === loadDataBy.barrons) {
        return await fetchArticlesForBarrons(url, rss);
      } else if (currentLoadType === loadDataBy.puppeteer) {
        return await fetchArticlesFromPuppeter(url, rss);
      } else if (currentLoadType === loadDataBy.accesswire) {
        return await fetchArticlesForAccessWire(url, rss);
      } else if (currentLoadType === loadDataBy.reuters) {
        return await fetchArticlesForReuters(url, rss);
      } else {
        const { data } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, */*'
          }
        });
        return data;
      }
    } catch (error) {
      console.error(error);
      LOG.error(error);
      return null;
    } finally {
      await waitFor(250);
    }
  };

  const blogPromises = blogs.map(fetchBlogData);

  const blogJsonData = await Promise.all(blogPromises);
  LOG.info("Blog data fetched for ", blogName, " successfully");
  const xmlToList = await Promise.all(
    blogJsonData.filter(Boolean).map(parseFeed),
  );
  LOG.info("Blog data parsed for ", blogName, " successfully");
  let entries = xmlToList
    .reduce((accumulator, current) => accumulator.concat(current), [])
    .filter((post) => isPostFiltered(post, blogName));

  LOG.info(
    "Blog data merged for ",
    blogName,
    " successfully",
    "with entries",
    entries.length,
  );

  // Apply AI filtering to remove class action and legal investigation posts
  const entriesBeforeAI = entries.length;
  entries = await filterPostsWithAI(entries, enableAI);
  LOG.info(
    "AI filtering removed",
    entriesBeforeAI - entries.length,
    "legal/class action posts from",
    blogName,
  );

  return entries;
};

const fetchData = async (blogName, enableAI = false) => {
  const entries = await fetchEntries(blogName, enableAI);
  const rssXml = convertEntriesToRss(blogName, entries);
  await writeToFile(blogName, rssXml);

  LOG.info("Blog data written for ", blogName, " successfully");
};



module.exports = {
  fetchData,
  fetchEntries,
  createRetryPromise,
  parseFeed,
  isPostFiltered
};
