const { default: axios } = require("axios");
const fs = require("fs")
const gainersList = require("./../config/gainers.json")
const losersList = require("./../config/losers.json");
const { waitFor } = require("./utils");
const { convertEntriesToRss } = require("../utils/feed");
const { writeToFile } = require("../utils/fileUtils");

const fetchNewsList = async (list)=>{
    let newsFeed = [];
    for(let i=0; i < list.length; i++){
        const numberOfDays = 2;
        const symbol = (list[i]?.text || []).map(x=>x.replace("$","").replace(":",""));
        const query = `symbols:${symbol} AND (source.id:prNewswire OR source.id:businesswire OR source.id:globenewswire OR source.id:accesswire OR source.id:reuters OR source.id:barrons)`;
        const payload = {
            "type": "filterArticles",
            "isPublic": false,
            "queryString": query,
            "from":0,
            "size":50
        }
        const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik5ERkdNemcyUXpsR01ERXlOMFk0TTBFelFqRXdPRVExTVRnd1F6YzVOamxCTlRJNFJqaERNdyJ9.eyJpc3MiOiJodHRwczovL2xvZ2luLm5ld3NmaWx0ZXIuaW8vIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMDU3NDgwNzY5NzU2NjgwNTkyMzAiLCJhdWQiOlsiTmV3c0ZpbHRlci5pbyIsImh0dHBzOi8vbmV3c2ZpbHRlci5hdS5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzExMjUyMjU0LCJleHAiOjE3MTEzMzg2NTQsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhenAiOiJTakJiRjRyVHdXU1hwOXp1Rm1Mc0FjNnR1M2VZWFVVRCJ9.ZYdtMi2tlDiJoxmL_TorVhd9RO80AUgjlOH2qmq3oNe_fB2vgdvvn5blTcnBsP2sUaUoEjpGXfdNzKxjmLb5SbeKywhvLdnGD8lKXQhUvOgcGGBiFlaAQJXKz4nz6v5AdNGahCzi5XiJEpPiJwoir3KL-2nhuz72X82w4uTUIcvAtk20XmqgZTCsgMeD8Z5ImHUBiMoQsmdpaJ2p5mSsAKbbmvfUSmDuReX4uN8SjJZaCgtY7OMysfcLxPefIlb1_4aZuntEww6z1nJ9St8t0TrlVfEn29_2yohXLkUeT6VwnEq__QyuJ7kbGu_HOzBlnrQRNMzuO9IaNHyZr2aoCg'
        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'authorization': `Bearer ${token}`,
            'caching-key': 'sfksmdmdg0aadsf224533130',
            'content-type': 'application/json;charset=UTF-8',
            'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site'
          };
        const { data } = await axios.post(`https://api.newsfilter.io/actions`,  payload, { headers })
        const filteredArticles = (data?.articles || []).filter((article)=>{
            const maxDate = list[i]?.created_at && new Date(list[i].created_at);
            maxDate.setHours(0);
            maxDate.setMinutes(0);
            maxDate.setSeconds(0);
            maxDate.setMilliseconds(0);
            const minDate = new Date(maxDate - (numberOfDays * 24 * 60 * 60 * 1000));
            minDate.setHours(0);
            minDate.setMinutes(0);
            minDate.setSeconds(0);
            minDate.setMilliseconds(0);
            const postDate = new Date(article.publishedAt);
            const isBetween = postDate > minDate && postDate < maxDate;
            if(isBetween){
                article.date = article.publishedAt;
            }
            return isBetween
        })
        newsFeed = [...newsFeed, ...filteredArticles]
        console.log(newsFeed.length)
        await waitFor(Math.random() * 10 * 1000);
    }
    return newsFeed
}

const news = async ()=>{
    const gainers = await fetchNewsList(gainersList);
    const gainersXml = convertEntriesToRss("gainers", gainers);
    writeToFile("gainers", gainersXml)
    const losers = await fetchNewsList(losersList);
    const losersXml = convertEntriesToRss("losers", losers);
    writeToFile("losers", losersXml)
}

news();
