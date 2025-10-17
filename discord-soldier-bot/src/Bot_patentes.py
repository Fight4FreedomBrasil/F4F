import discord
from discord.ext import commands
import gspread
from config import SPREADSHEET_ID, SHEET_NAME, DISCORD_TOKEN
import datetime
import random

# --- Estrutura de Patentes e Pontos ATUALIZADA ---
RANKS_DATA = [
    {'Patente': 'Soldado', 'Pontos Necessários': 0, 'Tempo Necessário': 0},
    {'Patente': 'Cabo', 'Pontos Necessários': 50, 'Tempo Necessário': 0},
    {'Patente': '3º Sargento', 'Pontos Necessários': 80, 'Tempo Necessário': 50},
    {'Patente': '2º Sargento', 'Pontos Necessários': 100, 'Tempo Necessário': 75},
    {'Patente': '1º Sargento', 'Pontos Necessários': 120, 'Tempo Necessário': 100},
    {'Patente': 'Subtenente', 'Pontos Necessários': 130, 'Tempo Necessário': 125},
    {'Patente': '2º Tenente', 'Pontos Necessários': 150, 'Tempo Necessário': 150},
    {'Patente': '1º Tenente', 'Pontos Necessários': 170, 'Tempo Necessário': 200},
    {'Patente': 'Capitão', 'Pontos Necessários': 200, 'Tempo Necessário': 250},
    {'Patente': 'Major', 'Pontos Necessários': 230, 'Tempo Necessário': 300},
    {'Patente': 'Tenente-Coronel', 'Pontos Necessários': 280, 'Tempo Necessário': 400},
    {'Patente': 'Coronel', 'Pontos Necessários': 5000, 'Tempo Necessário': 1000},
    {'Patente': 'General de Brigada', 'Pontos Necessários': 5000, 'Tempo Necessário': 1000},
    {'Patente': 'General de Divisão', 'Pontos Necessários': 5000, 'Tempo Necessário': 1000},
    {'Patente': 'General de Exército', 'Pontos Necessários': 5000, 'Tempo Necessário': 1000},
    {'Patente': 'Marechal', 'Pontos Necessários': 5000, 'Tempo Necessário': 1000}
]

# --- Lista de Imagens de Fundo ---
BACKGROUND_IMAGES = [
    "https://images4.alphacoders.com/140/thumb-1920-1400244.jpg",
    "https://images.alphacoders.com/140/thumb-1920-1400243.jpg",
    "https://www.pixground.com/wp-content/uploads/2025/08/Battlefield-6-Recon-Sniper-Ghillie-Suit-Wallpaper-HD-1081x608.jpg",
    "https://i.ibb.co/Fqkfdx9j/bf6-wp4.png",
    "https://www.pixground.com/wp-content/uploads/2025/08/Battlefield-6-Engineer-Combat-Wallpaper-1081x608.jpg",
    "https://images8.alphacoders.com/140/thumb-1920-1401778.jpg",
    "https://www.pixground.com/wp-content/uploads/2025/08/Battlefield-6-Assault-Soldier-Wallpaper-1081x608.jpg",
    "https://images.alphacoders.com/139/thumb-1920-1399400.jpg",
    "https://www.pixground.com/wp-content/uploads/2025/08/Battlefield-6-Soldier-Support-Wallpaper-1081x608.jpg",
    "https://images4.alphacoders.com/140/thumb-1920-1400327.jpg",
    "https://images6.alphacoders.com/140/thumb-1920-1400245.jpg"

]

# Set up the Discord bot with a command prefix
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# --- Autenticação com gspread ---
gc = gspread.oauth(
    credentials_filename='credentials.json',
    authorized_user_filename='token.json'
)

@bot.event
async def on_ready():
    print(f'Bot conectado como {bot.user}')
    print('Pronto para receber comandos com o prefixo "!"')

@bot.command(name="patente")
async def patente(ctx, soldier_id: str):
    """Consulta informações de um soldado na planilha e responde com um Embed."""
    try:
        spreadsheet = gc.open_by_key(SPREADSHEET_ID)
        platoon_sheet = spreadsheet.worksheet(SHEET_NAME)

        # --- Lógica de busca case-insensitive ---
        all_data = platoon_sheet.get_all_values()
        headers = all_data[0]
        data_rows = all_data[1:]
        
        id_col_index = 2 
        
        soldier_row = None
        search_id_lower = soldier_id.lower()
        
        for row in data_rows:
            if len(row) > id_col_index and row[id_col_index].lower() == search_id_lower:
                soldier_row = row
                break

        if not soldier_row:
            await ctx.send(f"Soldado com ID **{soldier_id}** não encontrado.")
            return
        # --- Fim da lógica de busca ---

        soldier_info = dict(zip(headers, soldier_row))

        name = soldier_info.get('Nome', 'N/A')
        current_rank = soldier_info.get('Ranking', 'N/A').strip()
        points_str = soldier_info.get('Pontuação', '0')
        hours_str = soldier_info.get('Tempo de jogo', '0')
        medals_str = soldier_info.get('Medalhas', '')

        points = int(float(points_str.replace(',', '') if isinstance(points_str, str) else points_str))
        hours = int(float(hours_str.replace(',', '') if isinstance(hours_str, str) else hours_str))
        num_medals = len(medals_str.split(',')) if medals_str else 0

        # --- Lógica da Mensagem de Progresso (Corrigida) ---
        high_ranks = ["Coronel", "General de Brigada", "General de Divisão", "General de Exército", "Marechal"]
        progress_message = ""
        next_rank = None

        if current_rank in high_ranks:
            progress_message = "Oficial [F4F] - Obrigado por sua dedicação ao Clã!"
        else:
            current_rank_found = False
            for rank in RANKS_DATA:
                if current_rank_found:
                    next_rank = rank
                    break
                if rank.get('Patente').strip().lower() == current_rank.strip().lower():
                    current_rank_found = True
            
            if next_rank:
                needed_points = int(next_rank.get('Pontos Necessários', 0))
                needed_hours = int(next_rank.get('Tempo Necessário', 0))
                
                has_enough_points = points >= needed_points
                has_enough_hours = hours >= needed_hours

                if has_enough_points and has_enough_hours:
                    progress_message = f"Você já possui os requisitos para a próxima patente: **{next_rank.get('Patente')}**!"
                else:
                    points_to_go = max(0, needed_points - points)
                    hours_to_go = max(0, needed_hours - hours)
                    
                    missing = []
                    if points_to_go > 0:
                        missing.append(f"**{points_to_go:,}** pontos".replace(',', '.'))
                    if hours_to_go > 0:
                        missing.append(f"**{hours_to_go:,}** horas".replace(',', '.'))
                    
                    progress_message = f"Faltam { ' e '.join(missing) } para a próxima patente: **{next_rank.get('Patente')}**."
            else:
                progress_message = "Você alcançou a patente máxima, parabéns!"
        # --- Fim da Lógica da Mensagem ---

        # --- Criação do Embed (Novo Layout) ---
        embed = discord.Embed(
            title=f"RELATÓRIO DE COMBATE: {name}",
            description=f"**Progresso:** {progress_message}",
            color=discord.Color.gold(),
            timestamp=datetime.datetime.now(datetime.timezone.utc)
        )

        # --- Linha 1 de Campos ---
        embed.add_field(name="ID do Soldado", value=f"`{soldier_id}`", inline=True)
        embed.add_field(name="Patente Atual", value=current_rank, inline=True)
        embed.add_field(name="Pontuação Atual", value=f"{points:,}".replace(',', '.'), inline=True)

        # --- Linha 2 de Campos (Apenas se houver próxima patente) ---
        if next_rank and current_rank not in high_ranks:
            needed_points = int(next_rank.get('Pontos Necessários', 0))
            embed.add_field(name="Próxima Patente", value=next_rank.get('Patente'), inline=True)
            embed.add_field(name="Pontuação Necessária", value=f"{needed_points:,}".replace(',', '.'), inline=True)
            #embed.add_field(name="\u200b", value="\u200b", inline=True)

        # --- Linha 3 de Campos ---
        embed.add_field(name="Medalhas", value=f"🏅 {num_medals}", inline=True)
        embed.add_field(name="Horas de Jogo", value=f"{hours:,}".replace(',', '.'), inline=True)
        
        random_image_url = random.choice(BACKGROUND_IMAGES)
        embed.set_image(url=random_image_url)

        embed.set_footer(text="Pelotão F4F | Consulta de Patentes")

        await ctx.send(embed=embed)

    except gspread.exceptions.WorksheetNotFound as e:
        await ctx.send(f"Erro: A planilha '{e.args[0]}' não foi encontrada. Verifique os nomes em `config.py`.")
    except Exception as e:
        print(f"Erro inesperado: {e}")
        await ctx.send(f"Ocorreu um erro inesperado ao processar sua solicitação.")

# Run the bot
bot.run(DISCORD_TOKEN)
