import { Message } from "discord.js-selfbot-v13";
import { Discord } from "../discord.js";
import { command } from "@dank074/discord-video-stream";

export async function disconnectCommand(discord: Discord, msg: Message, args: string[]) {
    let stream = discord.streamClient.voiceConnection?.streamConnection;
    if (stream == null || msg.guild!.members.me!.voice?.channel == null) return;

    discord.ffmpeg?.kill("SIGINT");
    stream.setSpeaking(false);
    stream.setVideoStatus(false);
    discord.streamClient.stopStream();
    discord.streamClient.leaveVoice();

    await msg.react('👋')
        .then(() => console.log(`Disconnected from guild ${msg.guildId} by user ${msg.author.id}`))
        .catch(() => {
            console.error(`Unable to react to disconnect command from guild ${msg.guild!.id}`);
        });
}