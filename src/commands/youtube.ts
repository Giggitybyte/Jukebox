import { Discord } from "../discord.js";
import { command, MediaUdp } from "@dank074/discord-video-stream";
import { Message, RichPresence } from "discord.js-selfbot-v13";
import ytdl from 'ytdl-core';

export async function youtubeCommand(discord: Discord, msg: Message, args: string[]) {
    if (args.length != 1) return;
    await msg.react('🔗').catch(() => { });

    if (ytdl.validateURL(args[0]) == false) {
        await msg.react('❌').catch(() => { });
        return;
    }

    await new Promise<void>((resolve, reject) => {
        command?.kill('SIGINT');
        setTimeout(() => resolve(), 500);
    });

    let videoInfo = await ytdl.getInfo(args[0]);
    let formats = ytdl.filterFormats(videoInfo.formats, 'audioandvideo');
    let hdFormats = formats.filter(format => format.quality == 'hd720');

    let url: string;
    if (hdFormats.length > 0)
        url = hdFormats[0].url;
    else if (formats.length > 0)
        url = formats[0].url;
    else {
        console.warn(`Could not get direct URL for YouTube video ${videoInfo.videoDetails.videoId}`)
        await msg.react('⚠️').catch(() => { });
        return;
    }

    let videoTitle = (videoInfo.videoDetails.title.length > 100)
        ? `${videoInfo.videoDetails.title.substring(0, 100)}...`
        : videoInfo.videoDetails.title;
    discord.setStatus('📺', `Streaming YouTube: ${videoTitle}`);

    await msg.react('✅');

    discord.streamVideo(url, msg.guild!.id, msg.author.voice!.channelId!)
        .catch(e => {
            console.warn(`Something went wrong while streaming ${videoInfo.videoDetails.videoId} from YouTube in ${msg.guild!.id}\n${e}`);
            msg.react('⚠️').catch(() => { });
        });
}