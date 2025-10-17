# Discord Soldier Bot

This project is a Discord bot that retrieves soldier information from a Google Sheets document. Users can input a soldier's ID, and the bot will respond with the soldier's details, including their name, ID, points, hours of gameplay, number of medals, and the points and hours needed for the next rank.

## Project Structure

```
discord-soldier-bot
├── src
│   ├── Bot_patentes.py       # Main logic for the Discord bot
│   ├── config.py             # Configuration settings for the bot
│   └── sheets_handler.py      # Handles interactions with Google Sheets API
├── requirements.txt           # Lists project dependencies
└── README.md                  # Documentation for the project
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd discord-soldier-bot
   ```

2. **Install dependencies:**
   Make sure you have Python installed. Then, run:
   ```
   pip install -r requirements.txt
   ```

3. **Configure the bot:**
   Update the `src/config.py` file with your Discord webhook URL and Google Sheets ID.

4. **Run the bot:**
   Execute the following command to start the bot:
   ```
   python src/Bot_patentes.py
   ```

## Usage

- To retrieve soldier information, send a message in the Discord channel with the soldier's ID. The bot will respond with the soldier's details.

## Example

```
User: !soldier_info 12345
Bot: 
Name: John Doe
ID: 12345
Points: 1500
Hours of Gameplay: 50
Number of Medals: 5
Points Needed for Next Rank: 200
Hours Needed for Next Rank: 10
```

## Contributing

Feel free to submit issues or pull requests if you have suggestions or improvements for the bot.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.