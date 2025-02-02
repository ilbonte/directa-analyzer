function alignMovementDates(portfolioData, movimentiData) {
    const windowDays = 3;
    const tolerance = 0.01;
    const alignedMovements = [];

    movimentiData.forEach(movement => {
        const movementDate = new Date(movement.date.split('/').reverse().join('-'));
        const movementValue = movement.value;
        let bestExactMatch = null;
        let bestClosestMatch = null;
        let smallestDayDiff = Infinity;

        for (let i = 0; i < portfolioData.length - 1; i++) {
            const currPortfolio = portfolioData[i];
            const nextPortfolio = portfolioData[i + 1];

            const currDate = new Date(currPortfolio.date.split('/').reverse().join('-'));
            const daysDiff = Math.abs((currDate - movementDate) / (86400000));

            if (daysDiff > windowDays) continue;

            // Calcola le variazioni
            const liquidityChange = nextPortfolio.liquidita - currPortfolio.liquidita;
            const finanziamentoChange = currPortfolio.finanziamento - nextPortfolio.finanziamento;
            const totalChange = liquidityChange + finanziamentoChange;

            // Verifica corrispondenze esatte
            if (Math.abs(totalChange - movementValue) <= tolerance) {
                bestExactMatch = {
                    date: nextPortfolio.date,
                    type: 'total',
                    diff: Math.abs(totalChange - movementValue)
                };
                break; // Priorità massima, interrompe la ricerca
            }

            // Verifica corrispondenza solo liquidità
            if (!bestExactMatch && Math.abs(liquidityChange - movementValue) <= tolerance) {
                bestExactMatch = {
                    date: nextPortfolio.date,
                    type: 'liquidità',
                    diff: Math.abs(liquidityChange - movementValue)
                };
            }

            // Verifica corrispondenza solo finanziamento
            if (!bestExactMatch && Math.abs(finanziamentoChange - movementValue) <= tolerance) {
                bestExactMatch = {
                    date: nextPortfolio.date,
                    type: 'finanziamento',
                    diff: Math.abs(finanziamentoChange - movementValue)
                };
            }

            // Aggiorna la data più vicina
            if (daysDiff < smallestDayDiff) {
                smallestDayDiff = daysDiff;
                bestClosestMatch = {
                    date: currPortfolio.date,
                    type: 'closest',
                    diff: daysDiff
                };
            }
        }

        // Gestione risultati
        if (bestExactMatch) {
            alignedMovements.push({
                date: bestExactMatch.date,
                value: movementValue,
                originalDate: movement.date,
                matchedType: bestExactMatch.type
            });
        } else if (bestClosestMatch) {
            alignedMovements.push({
                date: bestClosestMatch.date,
                value: movementValue,
                originalDate: movement.date,
                matchedType: bestClosestMatch.type
            });
            console.log(`Warning: No exact match for movement on ${movement.date} of ${movementValue}€. Assigned closest date ${bestClosestMatch.date}`);
        } else {
            alignedMovements.push({
                date: movement.date,
                value: movementValue,
                originalDate: movement.date,
                matchedType: 'none'
            });
            console.log(`Warning: No matching date found within window for movement on ${movement.date} of ${movementValue}€`);
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
                    pointRadius: 0,
                },
                {
                    label: 'Movimenti Cumulativi',
                    data: dailyGains.map(day => day.cumulativeInvestment),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    yAxisID: 'y1',
                    pointRadius: 0
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
                zoom: {
                    animation: {
                        duration: 0
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy'
                    },
                    limits: {
                        y: {min: 'original', max: 'original'},
                        y1: {min: 'original', max: 'original'}
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'xy',
                        drag: {
                            enabled: true,
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            borderColor: 'rgb(75, 192, 192)',
                            borderWidth: 1,
                            threshold: 10
                        },
                    }
                },
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
                        color: 'rgb(75, 192, 192)'
                    },
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Movimenti (€)',
                        color: 'rgb(255, 99, 132)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(200, 200, 200, 0.2)'
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

        // Trova il giorno con il massimo gain e il massimo loss
    const { maxGain, maxLoss } = findMaxGainAndLoss(stats.dailyGains);

    // Aggiorna l'HTML con i nuovi dati
    $('#maxGainDate').text(maxGain.date);
    $('#maxGainValue').text(formatCurrency(maxGain.gainLoss));
    $('#maxLossDate').text(maxLoss.date);
    $('#maxLossValue').text(formatCurrency(maxLoss.gainLoss));


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
                    finanziamento: parseFloat(columns[2]),
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

function findMaxGainAndLoss(dailyGains) {
    let maxGain = { gainLoss: -Infinity };
    let maxLoss = { gainLoss: Infinity };

    dailyGains.forEach(day => {
        if (day.gainLoss > maxGain.gainLoss) {
            maxGain = day;
        }
        if (day.gainLoss < maxLoss.gainLoss) {
            maxLoss = day;
        }
    });

    return {
        maxGain: {
            date: maxGain.date,
            gainLoss: maxGain.gainLoss
        },
        maxLoss: {
            date: maxLoss.date,
            gainLoss: maxLoss.gainLoss
        }
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