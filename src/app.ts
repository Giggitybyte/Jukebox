import { discordBot } from "./discord/bot/discordBot.js";
import { discordUser } from "./discord/user/discordUser.js";

discordUser.gatewayClient.once('ready', async (client) => {
    await discordBot.connect();
    await discordBot.registerCommands();
});

discordUser.login();