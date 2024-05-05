module.exports = {
  allwires: {
    include: /(?:NASDAQ|NYSE)/i,
    exclude: /(?:DEADLINE ALERT:|SPHERE ANNOUNCES FIRST KEYNOTE|INVESTIGATION ALERT:|INVESTOR ACTION NOTICE:|STOCK ALERT:|INVESTOR ALERT:|Long-Term Shareholder Announcement:|DEADLINE REMINDER:|SHAREHOLDER ALERT:|SPECIAL ALERT:|Buyout Alert:|SHAREHOLDER UPDATE:|INVESTOR DEADLINE|SHAREHOLDER ACTION REMINDER|CLASS ACTION NOTICE:|Securities Class Action|Securities Fraud Class Action|Securities Fraud Lawsuit|Class Action Against|Class Action Lawsuit|Class Action Suit|Class Action Filed Against|BOARD OF DIRECTORS|Executive Vice President|Chief Executive Officer|Chief Communications Officer|Chief Operating Officer|Senior Notes Due 20|Earnings Conference Call on|Financial Results Conference Call on|Earnings Investor Call on|Investors Should Contact|Securities Law Violations|Shareholders that lost money|Investors who lost money|Stockholders and Encourages Investors to Contact the Firm|Federal Securities Laws and Encourages Investors|Announces Investigation of Shareholder Claims Against|Reminds Shareholders of a Lead Plaintiff Deadline|Investors Who Have Lost Money|Notifies Shareholders of|(Sets|Announces) Dates for .+Earnings Release|to Report .+Financial Results|Announces (Timing|Date) of .+Earnings Release|Announces (Timing|Date) of .+Conference Call|to (Report|Release|Announce) .+Quarter .+(Results|Earnings))/i
  },
    wsj: {
      include: /(?:\/deals\/)/i,
    },
    barrons:{
      include: /(?:.*)/i,
    },
    reuters:{
      include: /(?:\/markets\/\/us\/)/i,
    },
    learn:{
      include: /(?:.*)/i,
    }
};
