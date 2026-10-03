/** IDX sector baskets used by the IDX panel filter and by Ask Kuartal. Codes are IDX tickers without ".JK". */
export const SECTORS: Record<string, { label: string; codes: string[]; words: string[] }> = {
  banks: { label: 'Banks', codes: ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'BRIS', 'BBTN', 'ARTO'], words: ['bank', 'banks', 'banking', 'perbankan'] },
  coal: { label: 'Coal & energy', codes: ['AADI', 'ADRO', 'PTBA', 'ITMG', 'MEDC', 'PGAS', 'ADMR'], words: ['coal', 'batubara', 'energy', 'energi', 'oil', 'gas'] },
  metals: { label: 'Metals & nickel', codes: ['ANTM', 'INCO', 'MDKA', 'MBMA', 'AMMN'], words: ['nickel', 'nikel', 'metal', 'metals', 'mining', 'miners', 'tambang', 'gold miners', 'copper'] },
  telco: { label: 'Telco & towers', codes: ['TLKM', 'ISAT', 'EXCL', 'TOWR'], words: ['telco', 'telecom', 'telekomunikasi', 'towers'] },
  consumer: { label: 'Consumer', codes: ['ICBP', 'INDF', 'UNVR', 'AMRT', 'MAPI', 'MAPA', 'ACES', 'SIDO', 'KLBF', 'CPIN', 'JPFA'], words: ['consumer', 'konsumer', 'retail', 'food', 'staples'] },
  property: { label: 'Property & infra', codes: ['CTRA', 'SMRA', 'JSMR', 'SMGR', 'PGEO'], words: ['property', 'properti', 'infrastructure', 'infra', 'cement', 'toll'] },
  tech: { label: 'Tech', codes: ['GOTO', 'ARTO'], words: ['tech', 'technology', 'teknologi', 'startup', 'digital'] },
  conglo: { label: 'Conglomerates & industrial', codes: ['ASII', 'UNTR', 'BRPT', 'AKRA', 'ESSA', 'INKP'], words: ['conglomerate', 'konglomerasi', 'industrial', 'astra'] },
};
