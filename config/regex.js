module.exports = {
  allwires: {
    include: /(?:NASDAQ|NYSE)/i,
    exclude: /(?:DEADLINE ALERT:|SPHERE ANNOUNCES FIRST KEYNOTE|INVESTIGATION ALERT:|INVESTOR ALERT:|DEADLINE REMINDER:|SHAREHOLDER ALERT:|SPECIAL ALERT:|Buyout Alert:|SHAREHOLDER UPDATE:|INVESTOR DEADLINE|SHAREHOLDER ACTION REMINDER|CLASS ACTION NOTICE:|Securities Class Action|Securities Fraud Class Action|Securities Fraud Lawsuit|Class Action Against|Class Action Lawsuit|Class Action Suit|Class Action Filed Against|BOARD OF DIRECTORS|Executive Vice President|Chief Executive Officer|Chief Communications Officer|Chief Operating Officer|Senior Notes Due 20|Earnings Conference Call on|Financial Results Conference Call on|Earnings Investor Call on|Investors Should Contact|Securities Law Violations|Shareholders that lost money|Investors who lost money|Notifies Shareholders of)/i
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
