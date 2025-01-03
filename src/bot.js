const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('./config');
const {
  handleStart,
  handleAskCommand,
  handleReplyMode,
  handleMessage
} = require('./handlers');
const { handleError } = require('./utils/errorHandler');

// Single bot instance
let bot = null;
let isShuttingDown = false;

const cleanup = async () => {
  if (bot && !isShuttingDown) {
    isShuttingDown = true;
    console.log('Stopping bot...');
    try {
      await bot.stopPolling();
      bot = null;
      console.log('Bot stopped successfully');
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
    isShuttingDown = false;
  }
};

const startBot = async () => {
  // Clean up any existing instance
  await cleanup();

  try {
    // Create new bot instance with optimized polling settings
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
      polling: {
        params: {
          timeout: 30,
          limit: 100
        },
        interval: 2000 // Increased interval to reduce conflicts
      }
    });

    // Error handling
    bot.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.message.includes('Conflict')) {
        console.log('Detected polling conflict, cleaning up...');
        cleanup().catch(console.error);
      } else {
        console.error('Polling error:', error.message);
      }
    });
    
    bot.on('error', handleError);

    // Set bot commands
    await bot.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'ask', description: 'Ask a question' },
      { command: 'reply', description: 'Toggle reply mode (on/off)' }
    ]);

    // Register command handlers
    bot.onText(/\/start/, msg => handleStart(bot, msg));
    bot.onText(/\/ask(?:\s+(.+))?/, (msg, match) => handleAskCommand(bot, msg, match));
    bot.onText(/\/reply(?:\s+(.+))?/, (msg, match) => handleReplyMode(bot, msg, match));

    // Handle regular messages (for reply mode)
    bot.on('message', msg => {
      if (!msg.text?.startsWith('/')) {
        handleMessage(bot, msg);
      }
    });

    console.log('Bot started successfully!');
  } catch (error) {
    console.error('Error starting bot:', error);
    await cleanup();
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await cleanup();
  process.exit(1);
});

// Start the bot
startBot().catch(console.error);