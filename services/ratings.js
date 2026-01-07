const { default: axios } = require("axios");
const xml2js = require("xml2js");
const parser = new xml2js.Parser();
const { getDataFromFile, writeContentToFile } = require("../utils/fileUtils");
const path = require("path");
const { applicationLogger: LOG, postLogger } = require("./logger");
const {curlChildProcess, isWithInHours} = require("./utils");
const ratingsConfig =  require("./../config/ratings.json");
const { parseFeed, isPostFiltered } = require("./fetch");

const getAnalystRatings = async (companies = [], ignoreCompanies = false) => {
    const ratingsProms =  ratingsConfig.map(async(rating)=>{
        const { data } = await axios.get(rating.blogUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, */*'
            }
        });
        const items = await parseFeed(data);
        return (items || []).filter(item=>{
            const companyMatch =  companies.find(company=> {
                const regexPattern = `(?:NASDAQ|NYSE)(: |:)${company}`;
                const regex = new RegExp(regexPattern, "i"); 
                const regexMatch = item?.description?.match(regex);
                return regexMatch
            })
            
            return companyMatch;
        }).filter(Boolean)
    })
    const ratings = await Promise.all(ratingsProms);
    return (ratings || []).flat();
  };

  module.exports = {getAnalystRatings}