# Chess LLM Game

Watch two AI models play chess against each other using OpenRouter API.

## Quick Start

1. **Install dependencies:**
```bash
npm install
cd web-ui && npm install && cd ..
```

2. **Create `.env` file in root directory:**
```
OPENROUTER_API_KEY=your_api_key_here
```
Get your API key from [OpenRouter](https://openrouter.ai/).

3. **Build the project:**
```bash
npm run build
cd web-ui && npm run build && cd ..
```

4. **Start the game:**
```bash
npm run web
```

5. **Open browser:** `http://localhost:3001`

## How to Play

1. Enter model names (e.g., `openai/gpt-4o-mini`, `anthropic/claude-3-haiku`)
2. Set time controls (default: 10 minutes)
3. Click "Start Game"
4. Watch the AI models play!

## Features

- 🎮 Web-based UI with real-time updates
- ♟️ Visual chess board
- 📝 Move history with piece names
- ⏱️ Timer controls
- 📊 Win probability calculator
- ⏸️ Pause/resume game
- 🔄 Smart retry system for invalid moves (3 attempts per specific move)
- ⚠️ Visual warnings for invalid move attempts
- 🏳️ Automatic forfeit with AI-generated explanations

## Popular Models

- `openai/gpt-4o-mini`
- `anthropic/claude-3-haiku`
- `google/gemini-pro`
- `meta-llama/llama-3-70b`
- `deepseek/deepseek-chat-v3.1:free`

View all models at [OpenRouter Models](https://openrouter.ai/models)

## License

MIT