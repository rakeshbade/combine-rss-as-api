const { curly } = require("node-libcurl");
const querystring = require('querystring');
const { getCurlHttpHeaders } = require("./fetch");

const getEarningsCalendar = async ({numberOfWeeks})=>{
  // Dates should ignore millsec for tranding view query
  const startDate = Math.floor((Date.now() - 24 * 60 * 60 * 60 * 1000)/1000);
  const endDate = Math.floor((Date.now() + numberOfWeeks * 7 * 24 * 60 * 60 * 60 *1000)/1000);
  const url = 'https://scanner.tradingview.com/america/scan'; 
  const data = `{"filter":[{"left":"is_primary","operation":"equal","right":true},{"left":"earnings_release_date,earnings_release_next_date","operation":"in_range","right":[${startDate},${endDate}]}],"options":{"lang":"en"},"markets":["america"],"symbols":{"query":{"types":[]},"tickers":[]},"columns":["logoid","name","market_cap_basic","earnings_per_share_forecast_next_fq","earnings_per_share_fq","eps_surprise_fq","eps_surprise_percent_fq","revenue_forecast_next_fq","revenue_fq","earnings_release_next_date","earnings_release_next_calendar_date","earnings_release_next_time","description","type","subtype","update_mode","earnings_per_share_forecast_fq","revenue_forecast_fq","earnings_release_date","earnings_release_calendar_date","earnings_release_time","currency","fundamental_currency_code"],"sort":{"sortBy":"earnings_release_next_date","sortOrder":"desc"},"preset":null,"range":[0,150]}`;
  const headers = getCurlHttpHeaders(url);
  headers.push(`Content-Type: application/json`)
  const { data: responseData } = await curly.post(url, {
    postFields: querystring.stringify(data),
    httpHeader: headers,
  });
  return responseData;
}

module.exports = {getEarningsCalendar}