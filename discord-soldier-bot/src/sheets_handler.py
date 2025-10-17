from google.oauth2.service_account import Credentials
import gspread
from config import SPREADSHEET_ID

def get_soldier_info(soldier_id):
    # Authenticate and connect to Google Sheets
    creds = Credentials.from_service_account_file('path/to/your/service_account.json')
    client = gspread.authorize(creds)
    
    # Open the spreadsheet and select the relevant sheet
    sheet = client.open_by_key(SPREADSHEET_ID).worksheet('Platoon')
    
    # Get all data from the sheet
    data = sheet.get_all_records()
    
    # Search for the soldier by ID
    for soldier in data:
        if soldier['ID'] == soldier_id:
            name = soldier['Nome']
            points = soldier['Pontuação']
            hours = soldier['Tempo de jogo']
            medals = soldier['Medalhas']  # Assuming this is a count or a string of medals
            current_rank = soldier['Ranking']
            
            # Retrieve rank requirements
            rank_sheet = client.open_by_key(SPREADSHEET_ID).worksheet('Patente')
            rank_data = rank_sheet.get_all_records()
            next_rank_info = None
            
            for rank in rank_data:
                if rank['Nome'] == current_rank:
                    next_rank_info = rank
                    break
            
            if next_rank_info:
                points_needed = next_rank_info['Pontos Necessários']
                hours_needed = next_rank_info['Tempo Necessário']
            else:
                points_needed = 0
                hours_needed = 0
            
            return {
                'name': name,
                'id': soldier_id,
                'points': points,
                'hours': hours,
                'medals': medals,
                'points_needed': points_needed,
                'hours_needed': hours_needed
            }
    
    return None  # Soldier not found