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
                    yAxisID: 'y',
                    pointRadius: 0, // Rimuove i punti per un aspetto più pulito
                },
                {
                    label: 'Investimenti Cumulativi',
                    data: dailyGains.map(day => day.cumulativeInvestment),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    yAxisID: 'y1',
                    pointRadius: 0 // Rimuove i punti per un aspetto più pulito
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('it-IT', {
                                    style: 'currency',
                                    currency: 'EUR'
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Gain/Loss (€)',
                        color: 'rgb(75, 192, 192)' // Colore corrispondente alla linea
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)' // Colore della griglia più tenue
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Investimenti (€)',
                        color: 'rgb(255, 99, 132)' // Colore corrispondente alla linea
                    },
                    grid: {
                        drawOnChartArea: false // Rimuove la griglia per questo asse
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)' // Colore della griglia più tenue
                    }
                }
            }
        }
    });
}

function displayResults(stats) {
    $('#patrimonyInitial').text(formatCurrency(stats.patrimonyInitial));
    $('#patrimonyFinal').text(formatCurrency(stats.patrimonyFinal));
    $('#totalMovements').text(formatCurrency(stats.totalMovements));
    $('#totalGainLoss').text(formatCurrency(stats.totalGainLoss));

    updateChart(stats.dailyGains);
    $('.results').show();
}


function parseCSV(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const result = parseCSVContent(event.target.result);
      resolve(result);
    };
    reader.readAsText(file);
  });
}

function parseCSVContent(csvText) {
    const lines = csvText.split('\n');
    const headerIndex = findHeaderIndex(lines);

    if (headerIndex === -1) {
        return {
            portfolioData: [],
            movimentiData: [],
            warnings: ["Header non trovato"],
            error: "Formato CSV non valido: impossibile trovare l'header"
        };
    }

    const portfolioData = [];
    const movimentiData = [];
    const warnings = [];

    lines.slice(headerIndex + 1).forEach((line, index) => {
        if (!line.trim()) return; // Salta righe vuote

        const columns = line.split(',');

        try {
            // Parsing dati portafoglio (prima parte della riga)
            if (columns[0]?.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                portfolioData.push({
                    date: columns[0].trim(),
                    liquidita: parseFloat(columns[1]),
                    patrimonio: parseFloat(columns[6])
                });
            }

            // Parsing movimenti (seconda parte della riga)
            if (columns[8]?.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                movimentiData.push({
                    date: columns[8].trim(),
                    value: parseFloat(columns[10])
                });
            }
        } catch (error) {
            warnings.push(`Errore alla riga ${index + headerIndex + 2}: ${error.message}`);
        }
    });

    return {
        portfolioData: portfolioData.filter(Boolean),
        movimentiData: movimentiData.filter(Boolean),
        warnings,
        headerIndex
    };
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


if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseCSV,
    parseCSVContent,
    displayResults,
    chart,
    alignMovementDates,
    calculateStats,
    findHeaderIndex
  }
}