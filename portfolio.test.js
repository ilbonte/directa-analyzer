const { alignMovementDates, parseItalianNumber, calculateStats } = require('./portfolio');

describe('parseItalianNumber', () => {
    it('should correctly parse numbers with commas as decimals', () => {
        expect(parseItalianNumber('1,23')).toBe(1.23);
        expect(parseItalianNumber('')).toBe(0);
        expect(parseItalianNumber(null)).toBe(0);
    });
});