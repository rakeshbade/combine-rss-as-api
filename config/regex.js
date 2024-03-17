module.exports = {
  allwires: {
    include: /(?:NASDAQ|NYSE)/i,
    exclude: /(?:DEADLINE ALERT:|DEADLINE REMINDER:| Securities Class Action|Lead Class Action Lawsuit)/i
  },
    wsj: {
      include: /(?:\/deals\/)/i,
    },
    barrons:{
      include: /(?:.*)/i,
    },
    reuters:{
      include: /(?:.*)/i,
    }
};
