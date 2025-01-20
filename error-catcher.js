window.onerror = function (message, source, lineno, colno, error) {
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    const errorMessage = document.getElementById('errorMessage');
    const errorStack = document.getElementById('errorStack');

    // Mostra i dettagli dell'errore
    errorMessage.textContent = `${message} (${source}:${lineno}:${colno})`;
    errorStack.textContent = error ? error.stack : 'Stack non disponibile.';

    // Apri il modale
    modal.show();
};

window.addEventListener('unhandledrejection', function (event) {
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    const errorMessage = document.getElementById('errorMessage');
    const errorStack = document.getElementById('errorStack');

    // Mostra i dettagli del rejection
    errorMessage.textContent = `Unhandled Promise Rejection: ${event.reason}`;
    errorStack.textContent = event.reason?.stack || 'Stack non disponibile.';

    // Apri il modale
    modal.show();
});
