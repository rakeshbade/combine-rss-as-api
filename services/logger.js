const axios = require("axios");
var bunyan = require("bunyan");

const sendGrafanaLog = async (log) => {
  const userId = process.env.GRAFANA_USERID;
  const apiKey = process.env.GRAFANA_TOKEN;
  if (!userId || !apiKey) return;
  const { msg, time, pid, hostname, v, ...streams } = log;
  const dateTime = (
    Math.floor(new Date(time).getTime() / 1000) * 1000000000
  ).toString();
  const logs = {
    streams: [
      {
        stream: streams,
        values: [[dateTime, msg]],
      },
    ],
  };

  axios.post("https://logs-prod-006.grafana.net/loki/api/v1/push", logs, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userId}:${apiKey}`,
    },
  });
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
  sendGrafanaLog(message);
};

applicationLogger._emit = emitLogger;
eventLogger._emit = emitLogger;

module.exports = {
  applicationLogger,
  eventLogger,
};
