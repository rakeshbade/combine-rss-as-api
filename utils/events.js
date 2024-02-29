const EventEmitter = require('node:events');
const { fetchData } = require('../services/fetch');

const eventEmitter = new EventEmitter();
eventEmitter.on('fetchData', (blogName)=>{
  eventEmitter.removeListener('fetchData', ()=>{});
  fetchData(blogName)
});

module.exports = {eventEmitter}