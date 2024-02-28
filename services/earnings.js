const { curly } = require("node-libcurl");
const querystring = require('querystring');
const { getCurlHttpHeaders } = require("./fetch");
const { getDataFromFile, writeContentToFile } = require("../utils/fileUtils");
const path = require("path");
const { applicationLogger: LOG } = require("./logger");

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
    lastBuildDate: new Date().toISOString(),
    data: responseData
  }
  await writeContentToFile(fileName, JSON.stringify(content))
  return content;
}

module.exports = {getEarningsCalendar, getCompanyCodesFromEarningsData}