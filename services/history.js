const { default: axios } = require("axios");
const { waitFor } = require("./utils");
const { convertEntriesToRss } = require("../utils/feed");
const entries = require("./../config/entries.json");
const { writeToFile } = require("../utils/fileUtils");

const getEntriesByDate = async (entry, numberOfDays, page = 0)=>{
        const query = `symbols:${entry.symbol}`;
        const payload = {
            "type": "filterArticles",
            "isPublic": false,
            "queryString": query,
            "from":page,
            "size":50
        }
        const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik5ERkdNemcyUXpsR01ERXlOMFk0TTBFelFqRXdPRVExTVRnd1F6YzVOamxCTlRJNFJqaERNdyJ9.eyJpc3MiOiJodHRwczovL2xvZ2luLm5ld3NmaWx0ZXIuaW8vIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMDU3NDgwNzY5NzU2NjgwNTkyMzAiLCJhdWQiOlsiTmV3c0ZpbHRlci5pbyIsImh0dHBzOi8vbmV3c2ZpbHRlci5hdS5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzExODU2ODI4LCJleHAiOjE3MTE5NDMyMjgsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhenAiOiJTakJiRjRyVHdXU1hwOXp1Rm1Mc0FjNnR1M2VZWFVVRCJ9.Kh2UzhhJofvwMHXg3etZHIRW2M6oBh_dvUO2kXLAzBHlaxhzc4f6nOanT96nIt4daSDvAatxN3JL_TE8GwW7jmXrZwBVOdcIxCHr_pGhioknzPn8G9T-Zyb10HbTszzcgbkvn3QGgrwE2n0hVZij0jUAvOm3yltviVAWIp4DhqaKjbibf0mZOZEGkFN-hQxkLvTYYsJ0KXt3kH-0H_KT8b5tskCsKRbI-xkEXJ-UYT6c0-Sg7E9GOs-jVeUNsQZGBEavubw60Vvjb86b-lD60-N98H3h0q3TkiaukZ_5G4mrTmSFgI9pLMMdoPQaDICOS1uVZU4Y8qnZjpZxzzoLKw'
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
          let data;
          try{
            const res = await axios.post(`https://api.newsfilter.io/actions`,  payload, { headers })
            data = res.data;
          }catch{
            await waitFor(Math.random() * 10 * 1000);
            return getEntriesByDate(entry, numberOfDays, page + data?.articles?.length || 0)
          }
        if(!data?.articles?.length) return entry;
        const firstPost = data.articles[0];
        // first post older than 7 days
        if((new Date(firstPost.publishedAt).getTime() + (numberOfDays * 24 * 60 * 60 * 1000)) < (new Date(entry.created_at).getTime())) return entry;
        const isPostBetween = (article)=>{
            const maxDate = entry.created_at && new Date(entry.created_at);
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
            if(article.symbols.length > 2) return false;
            return isBetween
        }
        const filteredArticles = (data?.articles || []).filter((article)=>{
            return isPostBetween(article)
        });
        
        entry.articles = [...entry.articles, ...filteredArticles];
        console.log(entry.articles.length)
        await waitFor(Math.random() * 10 * 1000);
        return getEntriesByDate(entry, numberOfDays, page + data.articles.length)
}

const fetchNewsList = async (list)=>{
    let newsFeed = [];
    for(let i=0; i < list.length; i++){
        const numberOfDays = 7;
        const entry = list[i];
        for(let x of entry.text){
            const symbol = x.replace("$","").replace(":","")
            const entryPayload = await getEntriesByDate({symbol, created_at: entry.created_at, articles: []}, numberOfDays);
            await waitFor(Math.random() * 10 * 1000);
            newsFeed = [...newsFeed, ...entryPayload.articles];
        }

    }
    return newsFeed
}

const getGainers = (entries)=>{
    return entries.map(x=>Object(x).content?.itemContent).filter(Boolean).map(x=>x.tweet_results).filter(Boolean).map(x=>{ const startChar = 'Top Gainers'; const endChar = 'Top Losers'; return {text: x.result.legacy.full_text.substring(x.result.legacy.full_text.indexOf(startChar)+1,x.result.legacy.full_text.indexOf(endChar)).match(/\$(.*?):/g), created_at: x.result.legacy.created_at}}).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
}
const getLosers = (entries)=>{
    return entries.map(x=>Object(x).content?.itemContent).filter(Boolean).map(x=>x.tweet_results).filter(Boolean).map(x=>{ const startChar = 'Top Losers'; const endChar = '#stocktrading'; return {text: x.result.legacy.full_text.substring(x.result.legacy.full_text.indexOf(startChar)+1,x.result.legacy.full_text.indexOf(endChar)).match(/\$(.*?):/g), created_at: x.result.legacy.created_at}}).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
}

const news = async ()=>{
    const gainersList = getGainers(entries);
    const losersList = getLosers(entries);
    const gainers = await fetchNewsList(gainersList);
    const gainersXml = convertEntriesToRss("gainers", gainers);
    writeToFile("gainers", gainersXml)
    const losers = await fetchNewsList(losersList);
    const losersXml = convertEntriesToRss("losers", losers);
    writeToFile("losers", losersXml)
}

news();
