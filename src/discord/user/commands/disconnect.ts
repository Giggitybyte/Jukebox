import { Message } from "discord.js-selfbot-v13";
import { DiscordUser } from "../discordUser.js";

export async function disconnectCommand(discord: DiscordUser, msg: Message, args: string[]) {
    if (await discord.closeStream()) {
        await msg.react('👋')
            .then(() => console.log(`Disconnected from guild ${msg.guildId} by user ${msg.author.id}`))
            .catch(() => { });
    }
}