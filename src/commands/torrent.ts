import { Discord } from "../discord";
import { isValidMagnetLink } from "../util";
import { Message } from "discord.js-selfbot-v13";
import { Readable } from "stream";
import torrentStream from 'torrent-stream';

const videoExtensions = ['.webm', '.mkv', '.flv', '.avi', '.vob', '.mp4', '.mpg', '.mpeg', '.3gp', '.3g2'];
const audioExtensions = [];

export async function torrentCommand(discord: Discord, msg: Message, args: string[]) {
    await msg.react('🧲').then(r => msg.react('🔗')).catch(() => { });

    if (isValidMagnetLink(args[0])) {
        await msg.channel.sendTyping();
    } else {
        await msg.react('❌').catch(() => { });
        return;
    }

    let magnetLink: string = args[0];
    let torrentEngine = torrentStream(magnetLink);

    await new Promise<void>((resolve) => {
        torrentEngine.on('ready', () => resolve());
    });

    let videoFiles = torrentEngine.files.filter(file => {
        return videoExtensions.some(ext => file.name.endsWith(ext));
    });

    let videoFile: TorrentStream.TorrentFile | null = null;
    videoFile = videoFiles[0];

    // if (videoFiles.length == 1) {
    //     videoFile = videoFiles[0];
    // } else if (videoFiles.length > 1) {
    //     // display results decending by size
    // }

    if (videoFile == null) {
        await msg.react('❌').catch(() => { });
        return;
    }

    await msg.react('✅');
    await msg.reply(`Streaming **${videoFile.name}**`)

    discord.setStatus('📺', `Streaming Torrent: ${(videoFile.name.length > 100) ? `${videoFile.name.substring(0, 100)}...` : videoFile.name}`);
    discord.streamVideo(videoFile.createReadStream(), msg.guild!.id, msg.author.voice!.channelId!)
        .catch(e => {
            console.warn(`Something went wrong while streaming ${magnetLink} in ${msg.guild!.id}\n${e}`);
            msg.react('⚠️').catch(() => { });
        })
        .finally(() => {
            torrentEngine.destroy(() => { });
        });

    // filter all common video files.
    // if only one video, play that
    // else display results decending by size.
    //
}