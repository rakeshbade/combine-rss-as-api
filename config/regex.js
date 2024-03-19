module.exports = {
  allwires: {
    include: /(?:NASDAQ|NYSE)/i,
    exclude: /(?:DEADLINE ALERT:|INVESTIGATION ALERT:|INVESTOR ALERT:|DEADLINE REMINDER:|SHAREHOLDER ALERT:|SPECIAL ALERT:|Buyout Alert:|SHAREHOLDER UPDATE:|INVESTOR DEADLINE| Securities Class Action| Class Action Lawsuit| Securities Fraud Lawsuit|BOARD OF DIRECTORS|Executive Vice President|Chief Executive Officer)/i
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
