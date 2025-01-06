import pandas as pd
from datetime import datetime

import pandas as pd
from datetime import datetime, timedelta


def analyze_yearly_stats(portfolio_df, results_df, movimenti_df):
    yearly_stats = {}

    for year in portfolio_df['Data'].dt.year.unique():
        # Filter data for the year
        year_portfolio = portfolio_df[portfolio_df['Data'].dt.year == year]
        year_results = results_df[results_df['Data'].dt.year == year]
        year_movimenti = movimenti_df[movimenti_df['Data'].dt.year == year]

        # Get start and end dates for the year
        start_date = year_portfolio['Data'].min()
        end_date = year_portfolio['Data'].max()
        days_in_year = (end_date - start_date).days + 1

        stats = {
            'period': f"{start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')} ({days_in_year} days)",
            'patrimonio_iniziale': year_portfolio['Patrimonio'].iloc[0],
            'patrimonio_finale': year_portfolio['Patrimonio'].iloc[-1],
            'totale_movimenti': year_movimenti['Valore'].sum(),
            'gain_loss_totale': year_results['Gain/Loss'].sum(),
            'rendimento': ((year_portfolio['Patrimonio'].iloc[-1] -
                            year_movimenti['Valore'].sum() -
                            year_portfolio['Patrimonio'].iloc[0]) /
                           year_portfolio['Patrimonio'].iloc[0] * 100),
            'media_gain_loss': year_results['Gain/Loss'].mean(),
            'std_gain_loss': year_results['Gain/Loss'].std(),
            'mediana_gain_loss': year_results['Gain/Loss'].median(),
            'giorni_positivi': (year_results['Gain/Loss'] > 0).sum(),
            'giorni_negativi': (year_results['Gain/Loss'] < 0).sum()
        }

        yearly_stats[year] = stats

    return yearly_stats


def print_yearly_stats(yearly_stats):
    for year, stats in yearly_stats.items():
        print(f"\nAnalisi {year} ({stats['period']}):")
        print(f"Patrimonio iniziale: {stats['patrimonio_iniziale']:.2f} €")
        print(f"Patrimonio finale: {stats['patrimonio_finale']:.2f} €")
        print(f"Totale movimenti: {stats['totale_movimenti']:.2f} €")
        print(f"Gain/Loss totale: {stats['gain_loss_totale']:.2f} €")
        print(f"Rendimento: {stats['rendimento']:.2f}%")
        print(f"\nStatistiche aggiuntive {year}:")
        print(f"Media gain/loss giornaliero: {stats['media_gain_loss']:.2f} €")
        print(f"Deviazione standard gain/loss: {stats['std_gain_loss']:.2f} €")
        print(f"Mediana gain/loss giornaliero: {stats['mediana_gain_loss']:.2f} €")
        print(f"Giorni positivi: {stats['giorni_positivi']}")
        print(f"Giorni negativi: {stats['giorni_negativi']}")

def align_movement_dates(portfolio_df, movimenti_df):
    aligned_movements = []
    window_days = 3

    for _, movement in movimenti_df.iterrows():
        movement_date = movement['Data']
        movement_value = movement['Valore']
        found_match = False

        # Search window around the movement date
        start_date = movement_date - timedelta(days=window_days)
        end_date = movement_date + timedelta(days=window_days)

        # Filter portfolio data within window
        window_data = portfolio_df[(portfolio_df['Data'] >= start_date) & (portfolio_df['Data'] <= end_date)]

        for i in range(len(window_data) - 1):
            curr_liq = window_data.iloc[i]['Liquidità']
            next_liq = window_data.iloc[i + 1]['Liquidità']

            if (movement_value < 0 and (next_liq - curr_liq) <= movement_value + 0.01) or \
                (movement_value > 0 and (next_liq - curr_liq) >= movement_value - 0.01):
                aligned_movements.append({
                    'Data': window_data.iloc[i + 1]['Data'],
                    'Valore': movement_value,
                    'Original_Date': movement_date
                })
                found_match = True
                break

        if not found_match:
            print(
                f"Warning: No matching liquidità change found for movement on {movement_date.strftime('%d/%m/%Y')} of {movement_value:.2f}€")

    return pd.DataFrame(aligned_movements)
def analyze_portfolio(data_file):
    # Read CSV
    df = pd.read_csv(data_file, sep=',', header=6)

    # Define columns with unique identifiers
    portfolio_df = df.iloc[:, [0, 1, 2, 3, 4, 5, 6]].dropna()
    movimenti_df = df.iloc[:, [8, 9, 10]].dropna()

    # Convert dates
    portfolio_df['Data'] = pd.to_datetime(portfolio_df['Data'], format='%d/%m/%Y')
    movimenti_df['Data'] = pd.to_datetime(movimenti_df['Data.1'], format='%d/%m/%Y')

    # Align movement dates with portfolio changes
    aligned_movimenti_df = align_movement_dates(portfolio_df, movimenti_df)

    # Sort dataframes by date
    portfolio_df = portfolio_df.sort_values('Data')

    # Initialize lists for results
    daily_gains = []
    previous_patrimonio = None

    # Analyze each day
    for idx, row in portfolio_df.iterrows():
        current_date = row['Data']
        current_patrimonio = row['Patrimonio']

        # Find movements for the day
        movimenti_giorno = aligned_movimenti_df[aligned_movimenti_df['Data'] == current_date]['Valore'].sum()

        if movimenti_giorno != 0:
            print(f"Movement day: {current_date.strftime('%d/%m/%Y')} - {movimenti_giorno:.2f} €")

        # Calculate gain/loss
        if previous_patrimonio is not None:
            diff_patrimonio = current_patrimonio - previous_patrimonio
            gain_loss = diff_patrimonio - movimenti_giorno

            daily_gains.append({
                'Data': current_date,
                'Patrimonio': current_patrimonio,
                'Movimenti del giorno': movimenti_giorno,
                'Gain/Loss': gain_loss,
                'Gain/Loss %': (gain_loss / previous_patrimonio) * 100 if previous_patrimonio != 0 else 0
            })

        previous_patrimonio = current_patrimonio

    # Create results DataFrame
    results_df = pd.DataFrame(daily_gains)

    # Calculate cumulative statistics
    total_gain_loss = results_df['Gain/Loss'].sum()
    total_movimenti = aligned_movimenti_df['Valore'].sum()
    patrimonio_iniziale = portfolio_df['Patrimonio'].iloc[0]
    patrimonio_finale = portfolio_df['Patrimonio'].iloc[-1]

    # Calculate total return excluding movements
    rendimento_totale = ((patrimonio_finale - total_movimenti - patrimonio_iniziale) / patrimonio_iniziale) * 100

    yearly_stats = analyze_yearly_stats(portfolio_df, results_df, aligned_movimenti_df)
    print_yearly_stats(yearly_stats)

    return results_df, total_gain_loss, total_movimenti, rendimento_totale, patrimonio_iniziale, patrimonio_finale
# Analizza i dati
results, total_gain_loss, total_movimenti, rendimento_totale, patrimonio_iniziale, patrimonio_finale = analyze_portfolio(
    '/home/bonte/Downloads/Asset_88846_20250103.csv')

# Stampa i risultati
print("\nAnalisi del portafoglio:")
print(f"Patrimonio iniziale: {patrimonio_iniziale:.2f} €")
print(f"Patrimonio finale: {patrimonio_finale:.2f} €")
print(f"Totale movimenti: {total_movimenti:.2f} €")
print(f"Gain/Loss totale: {total_gain_loss:.2f} €")
print(f"Rendimento totale: {rendimento_totale:.2f}%")

# Mostra statistiche giornaliere
print("\nGiorni con i maggiori guadagni:")
print(results.nlargest(5, 'Gain/Loss')[['Data', 'Gain/Loss', 'Gain/Loss %']].to_string())
print("\nGiorni con le maggiori perdite:")
print(results.nsmallest(5, 'Gain/Loss')[['Data', 'Gain/Loss', 'Gain/Loss %']].to_string())

# Calcola statistiche aggiuntive
print("\nStatistiche aggiuntive:")
print(f"Media gain/loss giornaliero: {results['Gain/Loss'].mean():.2f} €")
print(f"Deviazione standard gain/loss: {results['Gain/Loss'].std():.2f} €")
print(f"Mediana gain/loss giornaliero: {results['Gain/Loss'].median():.2f} €")
print(f"Giorni positivi: {(results['Gain/Loss'] > 0).sum()}")
print(f"Giorni negativi: {(results['Gain/Loss'] < 0).sum()}")

# Salva i risultati dettagliati in un nuovo CSV
results.to_csv('analisi_portafoglio_dettagliata.csv', index=False, float_format='%.2f')
