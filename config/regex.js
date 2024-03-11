module.exports = {
  allwires: {
    include: /(?:NASDAQ|NYSE)/i,
    exclude: /(?:(SHAREHOLDER|INVESTOR|SSR) ALERT:|SHAREHOLDER UPDATE:|SHAREHOLDER ACTION REMINDER:|INVESTOR DEADLINE APPROACHING:|Investors of .* in the Class Action Lawsuit Against|Investors to Inquire About Securities Class Action Investigation|continues to investigate potential securities claims on behalf of shareholders|Class Action Lawsuits (Have|Has) Been Filed Against|Class Action Lawsuit Filed on Behalf of|Investors to Secure Counsel Before Important Deadline|Investors in Securities Fraud Class Action Lawsuit|Investors to Secure Counsel Before Important|Announces Date of .* Financial Results|(to|Announces) (Present|Participate|Participation) (in|at).*.Conference|Incorporated to Speak at .* Conference|to (Report|Release|Announce).*Quarter.*Financial Results|Please contact the.*Firm to recover your loss|Announces Pricing of .*(Senior|Junior).*Notes|Investigating.*Behalf of.*Stockholders and Encourages Investors to Contact the Firm|Prices Senior Notes Offering|Announces.*Awards.*Winners|Announces Expiration of.*. (Senior|Junior) .*Notes|Appoints.* (to|as) Board of Directors|Investors Have Opportunity to Lead.*Fraud Lawsuit)/i
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
