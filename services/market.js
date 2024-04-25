const { default: axios } = require("axios");
const fs = require("fs")

const marketCodes = ['NYSE', 'NASDAQ', 'OTCQB','TSXV','OTCQX']

const updateDate = async (forceReload)=>{
    let result = [];
    const fileName = "././data/market.json";
    const shouldReload = fs.existsSync(fileName) ? forceReload : true;
    if(shouldReload){
        const apiKey = '3GBzPHgsqzSenwBwCfNp4ca6JNk7Hcvb';
        const urlsWithKey = marketCodes.map((x)=>{
            const url = `https://financialmodelingprep.com/api/v3/symbol/${x}?apikey=${apiKey}`;
            return axios.get(url)
        });
        const data = await Promise.all(urlsWithKey);
        const maxCap = 1000000000 // 1 Billion
        result = data.map((x)=>x.data).filter(Boolean).flat().filter((x)=>x.marketCap > maxCap)
        fs.writeFileSync(fileName, JSON.stringify(result))
        return result;
    }
    const data = fs.readFileSync(fileName);
    return JSON.parse(data);
}

module.exports = { updateDate, marketCodes }