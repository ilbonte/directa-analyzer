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
    let cumulativeInvestment = 0;
    const dailyGains = [];

    let previousPatrimonio = null;

    portfolioData.forEach((day) => {
        // Aggiorna il cumulativo degli investimenti per il giorno corrente
        const movimentiGiorno = alignedMovements
            .filter(m => m.date === day.date)
            .reduce((sum, m) => sum + m.value, 0);
        cumulativeInvestment += movimentiGiorno;

        if (previousPatrimonio !== null) {
            const currentPatrimonio = day.patrimonio;
            const diffPatrimonio = currentPatrimonio - previousPatrimonio;
            const gainLoss = diffPatrimonio - movimentiGiorno;
            cumulativeGainLoss += gainLoss;

            dailyGains.push({
                date: day.date,
                gainLoss: gainLoss,
                cumulativeGainLoss: cumulativeGainLoss,
                cumulativeInvestment: cumulativeInvestment
            });
        }
        previousPatrimonio = day.patrimonio;
    });

    return {
        dailyGains,
        totalGainLoss: cumulativeGainLoss,
        totalInvestments: cumulativeInvestment,
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
            datasets: [
                {
                    label: 'Gain/Loss Cumulativo',
                    data: dailyGains.map(day => day.cumulativeGainLoss),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: 'Investimenti Cumulativi',
                    data: dailyGains.map(day => day.cumulativeInvestment),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            pointStyle: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Gain/Loss (€)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Investimenti (€)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}


function displayResults(stats) {
    $('#totalStats').html(`
        <p>Patrimonio iniziale: ${formatCurrency(stats.patrimonyInitial)}</p>
        <p>Patrimonio finale: ${formatCurrency(stats.patrimonyFinal)}</p>
        <p>Totale movimenti: ${formatCurrency(stats.totalMovements)}</p>
        <p>Gain/Loss totale: ${formatCurrency(stats.totalGainLoss)}</p>
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

            // Determina se il CSV ha l'header nella prima riga o dopo i metadati
            const headerIndex = findHeaderIndex(lines);
            if (headerIndex === -1) {
                resolve({
                    error: "Formato CSV non valido: impossibile trovare l'header",
                    portfolioData: [],
                    movimentiData: []
                });
                return;
            }

            const portfolioData = [];
            const movimentiData = [];
            const warnings = [];

            // Processa le righe dopo l'header
            lines.slice(headerIndex + 1).forEach((line, index) => {
                if (!line.trim()) return; // Salta le righe vuote

                const columns = line.split(',');

                try {
                    // Parsing del portfolio
                    if (columns[0] && columns[0].trim().match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        portfolioData.push({
                            date: columns[0].trim(),
                            liquidita: parseItalianNumber(columns[1]),
                            patrimonio: parseItalianNumber(columns[6])
                        });
                    }

                    // Parsing dei movimenti
                    if (columns[8] && columns[8].trim().match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        movimentiData.push({
                            date: columns[8].trim(),
                            value: parseItalianNumber(columns[10])
                        });
                    }
                } catch (error) {
                    warnings.push(`Errore nel parsing della riga ${index + headerIndex + 2}: ${error.message}`);
                }
            });

            resolve({
                portfolioData,
                movimentiData,
                warnings,
                headerIndex
            });
        };
        reader.readAsText(file);
    });
}

function findHeaderIndex(lines) {
    const headerPattern = /^Data,Liquidità,Finanaziamento long,Garanzia short,Portafoglio,Margini compnensati,Patrimonio/i;

    // Cerca l'header in tutte le righe
    for (let i = 0; i < lines.length; i++) {
        if (headerPattern.test(lines[i].trim())) {
            return i;
        }
    }

    return -1; // Header non trovato
}

function formatCurrency(value) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}


console.log('portfolio.js loaded');
if (typeof module !== "undefined" && module.exports) {
    console.log('portfolio.js exported');
    module.exports = {
        parseCSV, parseItalianNumber, displayResults, chart, alignMovementDates, calculateStats
    }
}