const express = require("express");
const app = express();
const { fetchData, convertEntriesToRss } = require("./controllers/fetch");
const port = process.env.PORT || 3000; // You can choose any port number

app.get("/rss", async (req, res) => {
  const { blog } = req.query;
  if (!blog) return res.status(404).send({ message: "invalid query" });
  try {
    const entries = await fetchData(blog);
    const xmlFeedWithEntries = convertEntriesToRss(blog, entries);
    return res.send(xmlFeedWithEntries);
  } catch (e) {
    console.error(e);
    return res.status(500).send(e);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
