const axios = require("axios");
var bunyan = require("bunyan");

const sendGrafanaLog = async (log) => {
  const userId = process.env.GRAFANA_USERID;
  const apiKey = process.env.GRAFANA_API_KEY;
  const { msg, time, pid, hostname, v, ...streams } = log;
  const logs = {
    streams: [
      {
        stream: streams,
        values: [[time, msg]],
      },
    ],
  };

  axios.post(
    "https://logs-prod-006.grafana.net/loki/api/v1/push",
    JSON.stringify(logs),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer 817692:your-api-key",
      },
    },
  );
};

const name = "rss-api";
const applicationLogger = bunyan.createLogger({
  name,
  type: "application",
});
const eventLogger = bunyan.createLogger({
  name,
  type: "event",
});

const emitLogger = (message) => {
  console.log(message);
  // sendGrafanaLog(message);
};

applicationLogger._emit = emitLogger;
eventLogger._emit = emitLogger;

module.exports = {
  applicationLogger,
  eventLogger,
};
