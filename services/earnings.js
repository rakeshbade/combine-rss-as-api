const { curly } = require("node-libcurl");
const querystring = require('querystring');
const { getCurlHttpHeaders, createRetryPromise } = require("./fetch");
const { getDataFromFile, writeContentToFile } = require("../utils/fileUtils");
const secCompanies = require("./../data/sec-companies.json");
const path = require("path");
const { applicationLogger: LOG } = require("./logger");
const xml2js = require("xml2js");
const parser = new xml2js.Parser();

const isWithInHours = (date, hours = 24)=>{
    const timeDifference = Math.abs(new Date(date).getTime() - Date.now());
    const hoursDifference = timeDifference / (60 * 60 * 1000);
    return hoursDifference <= hours;
}

const getCompanyCodesFromEarningsData = (earnings)=>{
  if(typeof earnings =="string"){
    earnings = JSON.parse(earnings)
  }
  if(typeof earnings.data == "string"){
    earnings = JSON.parse(earnings.data).data
  }else{
    earnings = earnings.data.data
  }
  return (earnings || []).map((x)=>{
    if(!x || !x.s) return;
    const companyCodes = x.s.split(":");
    return companyCodes[1]
  }).filter(Boolean);
}

const getEarningsCalendar = async ({numberOfWeeks})=>{
  // Dates should ignore millsec for tranding view query
  LOG.info(`Get earning calendar for the next ${numberOfWeeks} weeks`);
  const fileName = path.join(__dirname, "./../data/earnings.json");
  const earningsData = await getDataFromFile(fileName);
  const parseEarnings = JSON.parse(earningsData);
  if(parseEarnings && parseEarnings.lastBuildDate){
    const { lastBuildDate } = parseEarnings;
    const rangeInHours = 12;
    if(isWithInHours(lastBuildDate, rangeInHours)){
      LOG.info(`Earnings are within last ${rangeInHours} hours`);
      return earningsData
    }
  }

  const startDate = Math.floor((Date.now() - 24 * 60 * 60 * 60 * 1000)/1000);
  const endDate = Math.floor((Date.now() + numberOfWeeks * 7 * 24 * 60 * 60 * 60 *1000)/1000);
  const url = 'https://scanner.tradingview.com/america/scan'; 
  LOG.info(`Get earnings from ${url}`);
  const data = `{"filter":[{"left":"is_primary","operation":"equal","right":true},{"left":"earnings_release_date,earnings_release_next_date","operation":"in_range","right":[${startDate},${endDate}]}],"options":{"lang":"en"},"markets":["america"],"symbols":{"query":{"types":[]},"tickers":[]},"columns":["logoid","name","market_cap_basic","earnings_per_share_forecast_next_fq","earnings_per_share_fq","eps_surprise_fq","eps_surprise_percent_fq","revenue_forecast_next_fq","revenue_fq","earnings_release_next_date","earnings_release_next_calendar_date","earnings_release_next_time","description","type","subtype","update_mode","earnings_per_share_forecast_fq","revenue_forecast_fq","earnings_release_date","earnings_release_calendar_date","earnings_release_time","currency","fundamental_currency_code"],"sort":{"sortBy":"earnings_release_next_date","sortOrder":"desc"},"preset":null,"range":[0,150]}`;
  const headers = getCurlHttpHeaders(url);
  headers.push(`Content-Type: application/json`)
  const { data: responseData } = await curly.post(url, {
    postFields: querystring.stringify(data),
    httpHeader: headers,
  });
  const content = {
    lastBuildDate: new Date().getTime(),
    data: responseData
  }
  await writeContentToFile(fileName, JSON.stringify(content))
  return content;
}

const secCompanyMap = Object.entries(secCompanies).reduce((acc, [index, sec])=>{
  if(!acc[sec.cik_str]){
    acc[sec.cik_str] = sec
  }
  return acc;
},{});


const secListingsByCik = (data)=>{
  return new Promise((resolve, reject) => {
    parser.parseString(data, (err, result) => {
      if(err) return reject(`Error parsing data: ${err}, Data: ${data} `);
      const entries = result?.["feed"]?.["entry"];
      const secEntries = (entries || []).map((entry)=>{
        const link = entry?.link?.[0]?.['$']?.['href'];
        const date =  entry?.updated?.[0];
        if(!link || !date) return;
        const regex = /\/data\/(\d+)\//;
        const cik = link.match(regex)[1];
        // look for cik in the sec entries
        if(!secCompanyMap[cik]) return;
        // escape old entries
        if(!isWithInHours(date,  24)) return;
        return {
          title: entry?.title?.[0],
          date,
          description: entry?.summary?.[0]?.['_'],
          url: link,
          cik,
          ticker: secCompanyMap[cik].ticker,
          dataUrl: `https://data.sec.gov/rss?cik=${cik}&type=&exclude=true&count=10`,
          company: secCompanyMap[cik].title
        }
      }).filter(x=> x && x.url);
      return resolve(secEntries)
    })
  })
}

const parseSecDataFeedToJson = (data, companyData)=>{
  const supportedFormTypes = [];
  return new Promise((resolve, reject) => {
    parser.parseString(data, (err, result) => {
      if(err) return reject(`Error parsing data: ${err}, Data: ${data} `);
      const entries = result?.["feed"]?.["entry"];
      const secEntries = (entries || []).map((entry)=>{
        const date =  entry?.updated?.[0];
        const url = entry?.link?.[0]?.['$']?.['href'];
        const summary = entry?.summary?.[0]?.['_'];
        const title = entry?.title?.[0];
        const formType = entry?.category?.[0]?.['$']?.['term'] || "UNKNOWN";
        if(supportedFormTypes.length){
          if(![supportedFormTypes].includes(formType)) return;
        }
        if(!data || !url || !summary || !title) return;
        return {
          date,
          url,
          summary: `FORM::[${formType}]::${summary}`,
          title: `CIK::[${companyData.cik}] - COMPANY::[${companyData.company} (${companyData.ticker})] - ${title}`,
        }
      }).filter(Boolean);
      return resolve(secEntries)
    })
  })
}

const secFormListings = async ()=>{
  const url = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=100&output=atom";
  const headers = getCurlHttpHeaders(url);
  headers.push(`Content-Type: application/atom+xml`);
  const { data: responseData } = await curly.get(url, {
    httpHeader: headers,
  });
  const feedXml = responseData.toString();
  return secListingsByCik(feedXml);
}

const getRecentSecFilingsForEarnings = async (companies = [])=>{
  const listings = await createRetryPromise(secFormListings);
  if(!listings.length) return []
  let earningsListings = listings;
  if(companies.length){
    earningsListings = (listings || []).filter((company)=>{
      return companies.find((c)=>company.ticker === c);
    })
  }
  const listingPromises = (earningsListings || []).map(async (listing)=>{
      const headers = getCurlHttpHeaders(listing.dataUrl);
      // headers.push(`Content-Type: application/atom+xml`);
      const  { data: responseData }  = await curly.get(listing.dataUrl, {
        httpHeader: headers,
      });
      if(!responseData) return;
      const feedXml = responseData.toString();
      const feedJson = await parseSecDataFeedToJson(feedXml, listing);
      return feedJson;
  }).filter(Boolean);
  const data = await Promise.all(listingPromises);
  return data.flat();
}

module.exports = {getEarningsCalendar, getCompanyCodesFromEarningsData, getRecentSecFilingsForEarnings}