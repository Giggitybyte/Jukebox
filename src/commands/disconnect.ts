import { Message } from "discord.js-selfbot-v13";
import { Discord } from "../discord.js";

export async function disconnectCommand(discord: Discord, msg: Message, args: string[]) {
    let stream = discord.streamClient.voiceConnection?.streamConnection;
    if (stream == null || msg.guild!.members.me!.voice?.channel == null) return;

    if (await discord.closeStream()) {
        await msg.react('👋')
            .then(() => console.log(`Disconnected from guild ${msg.guildId} by user ${msg.author.id}`))
            .catch(() => { });
    }
}