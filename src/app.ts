import { discord } from "./discord/discord.js";
import { discordToken, guildId } from "../config/discord.json"
import { jellyfinChannel } from "./discord/jellyfinChannel.js";
import { jellyfinApi } from "./jellyfin/jellyfinApi.js";
import { jellyfinChannelId } from "../config/discord.json"

discord.gatewayClient.login(discordToken);

discord.gatewayClient.on('ready', async (client) => {
    let guild = client.guilds.resolve(guildId);
    if (guild == null) throw new Error("Invalid guild ID.");
    
    if (jellyfinApi.servers.size > 0 && (jellyfinChannelId && jellyfinChannelId.length > 0)) {
        jellyfinChannel.initialize();
    }
});