const querystring = require("querystring");
const { getDataFromFile, writeContentToFile } = require("../utils/fileUtils");
const secCompanies = require("./../data/sec-companies.json");
const path = require("path");
const { applicationLogger: LOG, postLogger } = require("./logger");
const xml2js = require("xml2js");
const {curlChildProcess, isWithInHours} = require("./utils");
const { default: axios } = require("axios");
const parser = new xml2js.Parser();

// Get the largest file from SEC filing directory
const getLargestFileFromIndex = async (indexLink) => {
  try {
    const { data } = await axios.get(indexLink, {
      headers: {
        'User-Agent': 'RSS-News-Aggregator/1.0 (rss-api-service)',
        'Accept': 'application/json'
      }
    });
    
    const items = data?.directory?.item || [];
    if (!items.length) return null;
    
    // Sort by size (largest first), filter out empty sizes
    const sortedItems = items
      .filter(item => item.size && item.size !== '')
      .filter(item => item.name.endsWith('.htm') || item.name.endsWith('.html') || item.name.endsWith('.xml')) // only consider .htm files
      .sort((a, b) => parseInt(b.size) - parseInt(a.size));
    
    if (!sortedItems.length) return null;
    
    const largestFile = sortedItems[0];
    const baseUrl = data.directory.name;
    return `https://www.sec.gov${baseUrl}/${largestFile.name}`;
  } catch (error) {
    LOG.error(`Error fetching index.json: ${error.message}`);
    return null;
  }
};

const getCompanyCodesFromEarningsData = (earnings) => {
  if (typeof earnings == "string") {
    earnings = JSON.parse(earnings);
  }
  if (typeof earnings.data == "string") {
    earnings = JSON.parse(earnings.data).data;
  } else {
    earnings = earnings.data.data;
  }
  return (earnings || [])
    .map((x) => {
      if (!x || !x.s) return;
      const companyCodes = x.s.split(":");
      return companyCodes[1];
    })
    .filter(Boolean);
};

const getEarningsCalendar = async ({ numberOfWeeks }) => {
  // Dates should ignore millsec for tranding view query
  LOG.info(`Get earning calendar for the next ${numberOfWeeks} weeks`);
  const fileName = path.join(__dirname, "./../data/earnings.json");
  const earningsData = await getDataFromFile(fileName);
  const parseEarnings = JSON.parse(earningsData);
  if (parseEarnings && parseEarnings.lastBuildDate) {
    const { lastBuildDate } = parseEarnings;
    const rangeInHours = 12;
    if (isWithInHours(lastBuildDate, rangeInHours)) {
      LOG.info(`Earnings are within last ${rangeInHours} hours`);
      return earningsData;
    }
  }

  const startDate = Math.floor((Date.now() - 24 * 60 * 60 * 60 * 1000) / 1000);
  const endDate = Math.floor(
    (Date.now() + numberOfWeeks * 7 * 24 * 60 * 60 * 60 * 1000) / 1000,
  );
  const url = "https://scanner.tradingview.com/america/scan";
  LOG.info(`Get earnings from ${url}`);
  const data = `{"filter":[{"left":"is_primary","operation":"equal","right":true},{"left":"earnings_release_date,earnings_release_next_date","operation":"in_range","right":[${startDate},${endDate}]}],"options":{"lang":"en"},"markets":["america"],"symbols":{"query":{"types":[]},"tickers":[]},"columns":["logoid","name","market_cap_basic","earnings_per_share_forecast_next_fq","earnings_per_share_fq","eps_surprise_fq","eps_surprise_percent_fq","revenue_forecast_next_fq","revenue_fq","earnings_release_next_date","earnings_release_next_calendar_date","earnings_release_next_time","description","type","subtype","update_mode","earnings_per_share_forecast_fq","revenue_forecast_fq","earnings_release_date","earnings_release_calendar_date","earnings_release_time","currency","fundamental_currency_code"],"sort":{"sortBy":"earnings_release_next_date","sortOrder":"desc"},"preset":null,"range":[0,150]}`;
  const { data: responseData } = await axios.post(url, data, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/json'
    }
  })
  const content = {
    lastBuildDate: new Date().getTime(),
    data: responseData,
  };
  await writeContentToFile(fileName, JSON.stringify(content));
  return content;
};

const secCompanyMap = Object.entries(secCompanies).reduce(
  (acc, [index, sec]) => {
    if (!acc[sec.cik_str]) {
      acc[sec.cik_str] = sec;
    }
    return acc;
  },
  {},
);

const isSupportedForm = (title) => {
  if (!title) return false;
  const importantForms = [
    "SC 13D",      // Large ownership stakes (5%+) - activist investors
    "SC 13G",      // Passive ownership stakes (5%+)
    "8-K",         // Current events - major announcements, M&A, earnings
    "10-Q",        // Quarterly financial reports
    "10-K",        // Annual financial reports
    "FORM 3",      // Initial insider ownership
    "FORM 4",      // Changes in insider ownership (buy/sell)
    "144",         // Notice of insider stock sale
    "425",         // Merger/acquisition prospectus
    "SC TO",       // Tender offer statement
  ];
  
  const findForm = importantForms.find(form => (title || "").toUpperCase().startsWith(form));
  return Boolean(findForm);
};

const secListingsByCik = async (data) => {
  return new Promise((resolve, reject) => {
    parser.parseString(data, async (err, result) => {
      if (err) return reject(`Error parsing data: ${err}, Data: ${data} `);
      const entries = result?.["feed"]?.["entry"];
      const secEntries = [];
      
      for (const entry of entries || []) {
        const link = entry?.link?.[0]?.["$"]?.["href"];
        const date = entry?.updated?.[0];
        if (!link || !date) continue;
        
        // Convert -index.htm to index.json by removing everything after last "/" and adding /index.json
        const indexJsonLink = link.substring(0, link.lastIndexOf('/')) + '/index.json';
        const regex = /\/data\/(\d+)\//;
        const cik = link.match(regex)[1];
        
        // look for cik in the sec entries
        if (!secCompanyMap[cik]) continue;
        // escape old entries - 5 days
        if (!isWithInHours(date, 24 * 5)) continue;
        if (!isSupportedForm(entry?.title?.[0])) continue;
        
        // Get the largest file from index.json
        const primaryDocLink = await getLargestFileFromIndex(indexJsonLink);
        
        // Add 50ms delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!primaryDocLink) continue;
        
        const foundComp = secEntries.find((c) => c.cik === cik);
        if (foundComp) {
          foundComp.count = foundComp.count + 1 || 2;
          foundComp.description += `\n[${foundComp.count}] - ${primaryDocLink} `;
          foundComp.data.push(primaryDocLink);
          continue;
        }
        
        const post = {
          title: `COMPANY::(${secCompanyMap[cik].title} - ${secCompanyMap[cik].ticker}) - CIK::[${cik}] - ${entry?.title?.[0]}`,
          date,
          description: `COMPANY::(${secCompanyMap[cik].ticker}) - ${entry?.title?.[0]} \n ${primaryDocLink} \n`,
          url: `${primaryDocLink}`,
          cik,
          ticker: secCompanyMap[cik].ticker
        }
        postLogger.info(post)
        secEntries.push(post);
      }
      
      return resolve(secEntries.filter((x) => x && x.url));
    });
  });
};

const secFromListings = async () => {
  // SEC.gov requires a User-Agent header that identifies the caller
  // See: https://www.sec.gov/os/accessing-edgar-data
  const curlCommand = `curl 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=100&output=atom' -H 'User-Agent: RSS-News-Aggregator/1.0 (rss-api-service)' -H 'Accept: application/atom+xml,application/xml,text/xml,*/*' -H 'Accept-Language: en-US,en;q=0.9'`
  const feedXml = await curlChildProcess(curlCommand)
  return secListingsByCik(feedXml);
};

const getRecentSecFilingsForEarnings = async (companies = [], ignoreCompanies = false) => {
  const listings = await secFromListings();
  if (!listings.length) return [];
  if (companies.length && ignoreCompanies === true) {
    return (listings || []).filter((company) => {
      return companies.find((c) => company.ticker === c);
    });
  }
  return listings;
};

module.exports = {
  getEarningsCalendar,
  getCompanyCodesFromEarningsData,
  getRecentSecFilingsForEarnings
};
