import { Message } from "discord.js-selfbot-v13";
import { DiscordUser } from "../discordUser";

export async function volumeCommand(discord: DiscordUser, msg: Message, args: string[]) {
    let volume = parseInt(args[0])
    if (Number.isNaN(volume) === true || discord.streamClient.voiceConnection?.streamConnection === undefined) return;
    
    let oldVolume = discord.streamVolume;    
    let newVolume = discord.streamVolume = volume

    let emoji: string = '';
    if (oldVolume === newVolume) {
        emoji = '🔈';
    } else if (newVolume > oldVolume) {
        emoji = '🔊'
    } else if (newVolume < oldVolume) {
        emoji = '🔉'
    }

    await msg.react(emoji);
}