const EventEmitter = require('node:events');
const { fetchData } = require('../services/fetch');

const eventEmitter = new EventEmitter();
eventEmitter.on('fetchData', fetchData);

module.exports = {eventEmitter}