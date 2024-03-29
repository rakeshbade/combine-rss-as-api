const querystring = require("querystring");
const { getDataFromFile, writeContentToFile } = require("../utils/fileUtils");
const secCompanies = require("./../data/sec-companies.json");
const path = require("path");
const { applicationLogger: LOG, postLogger } = require("./logger");
const xml2js = require("xml2js");
const {curlChildProcess, isWithInHours} = require("./utils");
const { default: axios } = require("axios");
const parser = new xml2js.Parser();

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
  const { data: responseData } = await axios.post(url, data)
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
  const findForm = ["SC 13D"].find(form=> (title || "").toUpperCase().startsWith(form))
  return Boolean(findForm);
  
};

const secListingsByCik = (data) => {
  return new Promise((resolve, reject) => {
    parser.parseString(data, (err, result) => {
      if (err) return reject(`Error parsing data: ${err}, Data: ${data} `);
      const entries = result?.["feed"]?.["entry"];
      const secEntries = (entries || [])
        .reduce((acc, entry) => {
          const link = entry?.link?.[0]?.["$"]?.["href"];
          const date = entry?.updated?.[0];
          if (!link || !date) return acc;
          const regex = /\/data\/(\d+)\//;
          const cik = link.match(regex)[1];
          // look for cik in the sec entries
          if (!secCompanyMap[cik]) return acc;
          // escape old entries
          // 5 days
          if (!isWithInHours(date, 24 * 5)) return acc;
          const foundComp = acc.find((c) => c.cik === cik);
          if (foundComp) {
            foundComp.count = foundComp.count + 1 || 2;
            foundComp.description += `\n[${foundComp.count}] - ${link} `;
            return acc;
          }
          if (!isSupportedForm(entry?.title?.[0])) return acc;
          const post = {
            title: `COMPANY::(${secCompanyMap[cik].title} - ${secCompanyMap[cik].ticker}) - CIK::[${cik}] - ${entry?.title?.[0]}`,
            date,
            description: `[1] - ${link} \n`,
            url: `https://data.sec.gov/rss?cik=${cik}&type=&exclude=true&count=20`,
            cik,
            ticker: secCompanyMap[cik].ticker,
          }
          postLogger.info(post)
          acc.push(post);
          return acc;
        }, [])
        .filter((x) => x && x.url);
      return resolve(secEntries);
    });
  });
};

const secFromListings = async () => {
  // const curlCommand = `curl 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=100&output=atom' \
  // -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  // -H 'accept-language: en-US,en;q=0.9' \
  // -H 'cache-control: max-age=0' \
  // -H 'cookie: _gid=GA1.2.490164931.1711382626; _ga=GA1.1.2115862634.1708834616; _4c_=%7B%22_4c_s_%22%3A%22dZLBTuMwEIZfpfK5SWMndezcVl1pxQEQK%2BBaJfG0sYA6ckwNW%2BXdmSlpC6vdXtJ88%2Fmf0cQHFjvYsYqXnOcqL7TMpZ6zJ3gfWHVg3hp67FnFVL1pG15mia5rnRRcQtKYUieiqTcKygJA5mzO3o5ZUvJMcimK5ThnZnfK8GBgsNvdF0%2FnWixlTp7twyRiG6V5qYUspPjuEiH3FFmzf9Z9PEdNhRIzv6tEUO39313%2Fq7b9pB5Y6wxge65TrtIs2Qw4R%2FiDJMmzjFGqM69tWIf3nrwIzWwwT1gwsLctrKM1oaOAUqgL7cBuu0CY85IwDcdor9HujIuXY3wpLvR8TB57N97FAejkqvPuBWZckOzwk7LrusW%2FHjbg%2FVHpQuiHarGIMaZb57bPkLbuZYHSYAONPkCLhf0E8GZ8suSTPVqiZna%2F%2Bo385gu5W91eT%2BjXj%2FXD1U98ETi3kkLmRUrbxguHt4SNp2XzQmqF25YZLjM8s0rJIqPfOI4f%22%7D; _ga_300V1CHKH1=GS1.1.1711382633.34.1.1711383496.0.0.0; _ga_CSLL4ZEK4L=GS1.1.1711382633.16.1.1711383496.0.0.0' \
  // -H 'sec-ch-ua: "Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"' \
  // -H 'sec-ch-ua-mobile: ?0' \
  // -H 'sec-ch-ua-platform: "macOS"' \
  // -H 'sec-fetch-dest: document' \
  // -H 'sec-fetch-mode: navigate' \
  // -H 'sec-fetch-site: none' \
  // -H 'sec-fetch-user: ?1' \
  // -H 'upgrade-insecure-requests: 1' \
  // -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'`
  const curlCommand = `curl 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=100&output=atom' -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' -H 'accept-language: en-US,en;q=0.9' -H 'cache-control: max-age=0' -H 'cookie: _gid=GA1.2.490164931.1711382626; _ga=GA1.1.2115862634.1708834616; _4c_=%7B%22_4c_s_%22%3A%22dZLBTuMwEIZfpfK5SWMndezcVl1pxQEQK%2BBaJfG0sYA6ckwNW%2BXdmSlpC6vdXtJ88%2Fmf0cQHFjvYsYqXnOcqL7TMpZ6zJ3gfWHVg3hp67FnFVL1pG15mia5rnRRcQtKYUieiqTcKygJA5mzO3o5ZUvJMcimK5ThnZnfK8GBgsNvdF0%2FnWixlTp7twyRiG6V5qYUspPjuEiH3FFmzf9Z9PEdNhRIzv6tEUO39313%2Fq7b9pB5Y6wxge65TrtIs2Qw4R%2FiDJMmzjFGqM69tWIf3nrwIzWwwT1gwsLctrKM1oaOAUqgL7cBuu0CY85IwDcdor9HujIuXY3wpLvR8TB57N97FAejkqvPuBWZckOzwk7LrusW%2FHjbg%2FVHpQuiHarGIMaZb57bPkLbuZYHSYAONPkCLhf0E8GZ8suSTPVqiZna%2F%2Bo385gu5W91eT%2BjXj%2FXD1U98ETi3kkLmRUrbxguHt4SNp2XzQmqF25YZLjM8s0rJIqPfOI4f%22%7D; _ga_300V1CHKH1=GS1.1.1711382633.34.1.1711383496.0.0.0; _ga_CSLL4ZEK4L=GS1.1.1711382633.16.1.1711383496.0.0.0' -H 'sec-ch-ua: "Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"' -H 'sec-ch-ua-mobile: ?0' -H 'sec-ch-ua-platform: "macOS"' -H 'sec-fetch-dest: document' -H 'sec-fetch-mode: navigate' -H 'sec-fetch-site: none' -H 'sec-fetch-user: ?1' -H 'upgrade-insecure-requests: 1' -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'`
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
