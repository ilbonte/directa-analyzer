const {
  parseItalianNumber,
  alignMovementDates,
  calculateStats,
  parseCSVContent,
  findHeaderIndex
} = require('./portfolio');


describe('findHeaderIndex', () => {
  const testCSV = [
    'metadata1,value1',
    'metadata2,value2',
    'Data,Liquidità,Finanaziamento long,Garanzia short,Portafoglio,Margini compnensati,Patrimonio,,Data,Descrizione,Valore',
    '04/01/2022,933.67,0,0,1363.6,0,2297.27,,10/01/2022,Bollo,-1'
  ];

  it('should find header index correctly', () => {
    expect(findHeaderIndex(testCSV)).toBe(2);
  });

  it('should return -1 when header is missing', () => {
    expect(findHeaderIndex(['line1', 'line2'])).toBe(-1);
  });
});

describe('parseCSVContent', () => {
  const csvContent = [
    'Data,Liquidità,Finanaziamento long,Garanzia short,Portafoglio,Margini compnensati,Patrimonio,,Data,Descrizione,Valore',
    '04/01/2022,933.67,0,0,1363.6,0,2297.27,,10/01/2022,Bollo,-1',
    '05/01/2022,933.67,0,0,1352.81,0,2286.48,,08/04/2022,Bollo,-1',
    '06/01/2022,933.67,0,0,1332.88,0,2266.55,,08/07/2022,Bollo,-1'
  ].join('\n');

  it('should parse CSV content correctly', () => {
    const result = parseCSVContent(csvContent);

    expect(result.portfolioData).toEqual([
      { date: '04/01/2022', liquidita: 933.67, patrimonio: 2297.27 },
      { date: '05/01/2022', liquidita: 933.67, patrimonio: 2286.48 },
      { date: '06/01/2022', liquidita: 933.67, patrimonio: 2266.55 }
    ]);

    expect(result.movimentiData).toEqual([
      { date: '10/01/2022', value: -1 },
      { date: '08/04/2022', value: -1 },
      { date: '08/07/2022', value: -1 }
    ]);
  });
});

describe('alignMovementDates', () => {
  const portfolioData = [
    { date: '01/01/2023', liquidita: 1000, patrimonio: 2000 },
    { date: '04/01/2023', liquidita: 1500, patrimonio: 2500 },
    { date: '07/01/2023', liquidita: 1700, patrimonio: 2700 }
  ];

  const movimentiData = [
    { date: '02/01/2023', value: 500 },    // Should match 04/01 (liquidita change +500)
    { date: '05/01/2023', value: 200 },    // Should match 07/01 (liquidita change +200)
    { date: '10/01/2023', value: 1000 }    // No match
  ];

  it('should align movements with portfolio dates', () => {
    const aligned = alignMovementDates(portfolioData, movimentiData);

    expect(aligned).toEqual([
      { date: '04/01/2023', value: 500, originalDate: '02/01/2023' },
      { date: '07/01/2023', value: 200, originalDate: '05/01/2023' }
    ]);
  });
});

describe('calculateStats', () => {
  const portfolioData = [
    { date: '01/01', patrimonio: 1000 },
    { date: '02/01', patrimonio: 1500 },
    { date: '03/01', patrimonio: 1800 }
  ];

  const alignedMovements = [
    { date: '02/01', value: 300 },
    { date: '03/01', value: 200 }
  ];

  it('should calculate correct statistics', () => {
    const stats = calculateStats(portfolioData, alignedMovements);

    expect(stats.totalGainLoss).toBeCloseTo((1800 - 1000) - (300 + 200)); // 800 - 500 = 300
    expect(stats.totalMovements).toBe(500);
    expect(stats.patrimonyInitial).toBe(1000);
    expect(stats.patrimonyFinal).toBe(1800);
    expect(stats.dailyGains).toEqual([
      {
        date: '02/01',
        gainLoss: 1500 - 1000 - 300, // 200
        cumulativeGainLoss: 200,
        cumulativeInvestment: 300
      },
      {
        date: '03/01',
        gainLoss: 1800 - 1500 - 200, // 100
        cumulativeGainLoss: 300,
        cumulativeInvestment: 500
      }
    ]);
  });
});