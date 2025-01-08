function parseItalianNumber(str) {
    if (!str) return 0;
    return parseFloat(str.replace(',', '.'));
}


function alignMovementDates(portfolioData, movimentiData) {
    // todo: controllare cosa succede se ho più movimenti simili in date vicine o lo stesso giorno
    const windowDays = 3;
    const alignedMovements = [];

    movimentiData.forEach(movement => {
        const movementDate = new Date(movement.date.split('/').reverse().join('-'));
        const movementValue = movement.value;
        let foundMatch = false;

        for (let i = 0; i < portfolioData.length - 1; i++) {
            const currDate = new Date(portfolioData[i].date.split('/').reverse().join('-'));
            const nextDate = new Date(portfolioData[i + 1].date.split('/').reverse().join('-'));

            // Check if current portfolio date is within window of movement date
            const daysDiff = Math.abs((currDate - movementDate) / (1000 * 60 * 60 * 24));

            if (daysDiff <= windowDays) {
                const currLiq = portfolioData[i].liquidita;
                const nextLiq = portfolioData[i + 1].liquidita;
                const liquidityChange = nextLiq - currLiq;

                // Check if liquidity change matches movement value (with small tolerance)
                const tolerance = 0.01;
                if (Math.abs(liquidityChange - movementValue) <= tolerance) {
                    alignedMovements.push({
                        date: portfolioData[i + 1].date,
                        value: movementValue,
                        originalDate: movement.date
                    });
                    foundMatch = true;
                    break;
                }
            }
        }

        if (!foundMatch) {
            console.log(`Warning: No matching liquidity change found for movement on ${movement.date} of ${movementValue.toFixed(2)}€`);
        }
    });

    return alignedMovements;
}

function calculateStats(portfolioData, alignedMovements) {
    let cumulativeGainLoss = 0;
    const dailyGains = [];
    let previousPatrimonio = null;

    portfolioData.forEach((day) => {
        if (previousPatrimonio !== null) {
            const currentPatrimonio = day.patrimonio;
            const movimentiGiorno = alignedMovements
                .filter(m => m.date === day.date)
                .reduce((sum, m) => sum + m.value, 0);

            const diffPatrimonio = currentPatrimonio - previousPatrimonio;
            const gainLoss = diffPatrimonio - movimentiGiorno;

            cumulativeGainLoss += gainLoss;

            dailyGains.push({
                date: day.date,
                gainLoss: gainLoss,
                gainLossPerc: previousPatrimonio !== 0 ? (gainLoss / previousPatrimonio) * 100 : 0,
                cumulativeGainLoss: cumulativeGainLoss
            });
        }
        previousPatrimonio = day.patrimonio;
    });

    return {
        dailyGains,
        totalGainLoss: cumulativeGainLoss,
        patrimonyInitial: portfolioData[0].patrimonio,
        patrimonyFinal: portfolioData[portfolioData.length - 1].patrimonio,
        totalMovements: alignedMovements.reduce((sum, m) => sum + m.value, 0)
    };
}

let chart = null;

function updateChart(dailyGains) {
    if (chart) {
        chart.destroy();
    }

    const ctx = document.getElementById('gainLossChart');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyGains.map(day => day.date),
            datasets: [{
                label: 'Gain/Loss Cumulativo',
                data: dailyGains.map(day => day.cumulativeGainLoss),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            pointStyle: false,
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function displayResults(stats) {
    const rendimentoTotale = ((stats.patrimonyFinal - stats.totalMovements - stats.patrimonyInitial) /
        stats.patrimonyInitial * 100);

    $('#totalStats').html(`
        <p>Patrimonio iniziale: ${stats.patrimonyInitial.toFixed(2)} €</p>
        <p>Patrimonio finale: ${stats.patrimonyFinal.toFixed(2)} €</p>
        <p>Totale movimenti: ${stats.totalMovements.toFixed(2)} €</p>
        <p>Gain/Loss totale: ${stats.totalGainLoss.toFixed(2)} €</p>
        <p>Rendimento totale: ${rendimentoTotale.toFixed(2)}%</p>
    `);

    const gainLossValues = stats.dailyGains.map(day => day.gainLoss);
    const mean = gainLossValues.reduce((a, b) => a + b, 0) / gainLossValues.length;
    const std = Math.sqrt(gainLossValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gainLossValues.length);
    const positiveCount = gainLossValues.filter(v => v > 0).length;
    const negativeCount = gainLossValues.filter(v => v < 0).length;

    $('#additionalStats').html(`
        <p>Media gain/loss giornaliero: ${mean.toFixed(2)} €</p>
        <p>Deviazione standard gain/loss: ${std.toFixed(2)} €</p>
        <p>Giorni positivi: ${positiveCount}</p>
        <p>Giorni negativi: ${negativeCount}</p>
    `);

    updateChart(stats.dailyGains);
    $('#results').show();
}

function parseCSV(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const csv = event.target.result;
            const lines = csv.split('\n');

            const portfolioData = [];
            const movimentiData = [];

            //todo: find the numbers of lines to skip
            lines.slice(6).forEach(line => {
                const columns = line.split(',');

                // todo: decidere se tenere questo oppure no
                if (columns[0] && columns[0].trim().match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    portfolioData.push({
                        date: columns[0].trim(),
                        liquidita: parseItalianNumber(columns[1]),
                        patrimonio: parseItalianNumber(columns[6])
                    });
                }

                if (columns[8] && columns[8].trim().match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    movimentiData.push({
                        date: columns[8].trim(),
                        value: parseItalianNumber(columns[10])
                    });
                }
            });

            //todo: aggiungere warnings se non riesce a parsare il file
            //todo: che corner case ci possono essere?

            resolve({
                portfolioData: portfolioData,
                movimentiData: movimentiData
            });
        };
        reader.readAsText(file);
    });
}

console.log('portfolio.js loaded');
if (typeof module !== "undefined" && module.exports) {
    console.log('portfolio.js exported');
    module.exports = {
        parseCSV, parseItalianNumber, displayResults, chart, alignMovementDates, calculateStats
    }
}