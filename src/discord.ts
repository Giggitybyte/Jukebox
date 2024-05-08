import { Client, CustomStatus, RichPresence } from "discord.js-selfbot-v13";
import { AudioStream, H264NalSplitter, MediaUdp, Streamer, VideoStream } from "@dank074/discord-video-stream";
import { StreamOutput } from '@dank074/fluent-ffmpeg-multistream-ts';
import { Readable, Transform } from "stream";
import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import prism from "prism-media";
import { youtubeCommand } from "./commands/youtube.js";
import { disconnectCommand } from "./commands/disconnect.js";
import { jellyfinCommand } from "./commands/jellyfin/jellyfin.js";

export class Discord { // TODO: add idle video streamed from a local file    
    private _discordClient: Client;
    private _streamClient: Streamer;
    private _ffmpegCommand: FfmpegCommand | null

    public get streamClient() {
        return this._streamClient;
    }

    public get gatewayClient() {
        return this._discordClient;
    }

    constructor() {
        this._discordClient = new Client();
        this._streamClient = new Streamer(this._discordClient);

        this._discordClient.on('ready', () => {
            console.log(`Logged in as @${this._discordClient.user!.username}`);
            this.setIdleStatus();
        });

        this._discordClient.on("messageCreate", async (msg) => {
            if (!msg.guild || msg.author.bot || !msg.content || !msg.content.startsWith("//")) return;

            let message = msg.content.split(" ");
            let cmd = message.slice(0, 1)[0].substring(2);
            let args = message.slice(1);

            if (cmd === "help") {
                // ...
            } else if (cmd === "disconnect") {
                disconnectCommand(this, msg, args);
            } else if (args.length == 0 || msg.author.voice?.channelId == null) {
                return;
            } else if (cmd === "youtube") {
                youtubeCommand(this, msg, args);
            } else if (cmd === "jellyfin") {
                jellyfinCommand(this, msg, args);
            }
        });
    }

    public setStatus(emoji: string, message: string) {
        let status = new CustomStatus(this._discordClient)
            .setEmoji(emoji)
            .setState(message);

        this._discordClient.user!.setPresence({
            status: "online",
            activities: [status]
        });
    }

    public setIdleStatus() { // TODO: random idle status
        let status = new CustomStatus(this._discordClient)
            .setEmoji('⌛')
            .setState('Passing time...');

        this._discordClient.user!.setPresence({
            status: "idle",
            activities: [status]
        });
    }

    public async createLiveStream(guildId: string, channelId: string): Promise<MediaUdp> {
        await this.streamClient.joinVoice(guildId, channelId);

        // TODO: detect guild nitro level and try to stream at higher qualities.
        let udpConnection = await this.streamClient.createStream({
            width: 1280,
            height: 720,
            bitrateKbps: 10000,
            maxBitrateKbps: 10000,
            videoCodec: "H264",
            readAtNativeFps: true
        });

        return udpConnection;
    }

    public async playVideo(video: string | Readable, udpConnection: MediaUdp) {
        udpConnection.mediaConnection.setSpeaking(true);
        udpConnection.mediaConnection.setVideoStatus(true);

        console.log(`Started streaming`);
        await this.streamVideo(video, udpConnection)
            .then(msg => {
                console.log(`Finished streaming (${msg})`);
            })
            .finally(async () => {
                udpConnection.mediaConnection.setSpeaking(false);
                udpConnection.mediaConnection.setVideoStatus(false);

                this._ffmpegCommand?.kill("SIGINT");

                await new Promise<void>((resolve, reject) => {
                    setTimeout(() => resolve(), 1500);
                });

                this.streamClient.stopStream();
                this.streamClient.leaveVoice();

                this.setIdleStatus();
            });
    }

    private streamVideo(input: string | Readable, mediaUdp: MediaUdp) {
        return new Promise<string>((resolve, reject) => {
            const streamOpts = mediaUdp.mediaConnection.streamOptions;
            const videoStream: VideoStream = new VideoStream(mediaUdp, streamOpts.fps, streamOpts.readAtNativeFps);
            let videoOutput: Transform = new H264NalSplitter();
            let isHttpUrl = false;
            let isHls = false;

            if (typeof input === "string") {
                isHttpUrl = input.startsWith('http') || input.startsWith('https');
                isHls = input.includes('m3u') || input.includes('m3u8');
            }

            try {
                this._ffmpegCommand = ffmpeg(input)
                    .addOption('-loglevel', '0')
                    .addOption('-fflags', 'nobuffer')
                    .addOption('-analyzeduration', '0')
                    .on('end', () => {
                        this._ffmpegCommand = null;
                        resolve("video ended")
                    })
                    .on("error", (err, stdout, stderr) => {
                        this._ffmpegCommand = null;
                        reject('cannot play video ' + err.message)
                    })
                    .on('stderr', console.error);

                this._ffmpegCommand.output(StreamOutput(videoOutput).url, { end: false })
                    .noAudio()
                    .size(`${streamOpts.width}x?`)
                    .fpsOutput(streamOpts.fps ?? 30)
                    .videoBitrate(`${streamOpts.bitrateKbps}k`)
                    .format('h264')
                    .outputOptions([
                        '-tune zerolatency',
                        '-pix_fmt yuv420p',
                        `-preset ${streamOpts.h26xPreset}`,
                        '-profile:v baseline',
                        `-g ${streamOpts.fps}`,
                        `-bf 0`,
                        `-x264-params keyint=${streamOpts.fps}:min-keyint=${streamOpts.fps}`,
                        '-bsf:v h264_metadata=aud=insert'
                    ]);

                videoOutput.pipe(videoStream, { end: false });

                let audioStream: AudioStream = new AudioStream(mediaUdp);
                let opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });

                this._ffmpegCommand.output(StreamOutput(opus).url, { end: false })
                    .noVideo()
                    .audioChannels(2)
                    .audioFrequency(48000)
                    .format('s16le');

                opus.pipe(audioStream, { end: false });

                if (streamOpts.hardwareAcceleratedDecoding) this._ffmpegCommand.inputOption('-hwaccel', 'auto');
                if (streamOpts.readAtNativeFps) this._ffmpegCommand.inputOption('-re')

                if (isHttpUrl) {
                    let headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.3",
                        "Connection": "keep-alive"
                    }

                    this._ffmpegCommand.inputOption('-headers', Object.keys(headers)
                        .map(key => key + ": " + headers[key])
                        .join("\r\n"));

                    if (!isHls) this._ffmpegCommand.inputOptions([
                        '-reconnect 1',
                        '-reconnect_at_eof 1',
                        '-reconnect_streamed 1',
                        '-reconnect_delay_max 4294'
                    ]);
                }

                this._ffmpegCommand.run();
            } catch (e) {
                //audioStream.end();
                //videoStream.end();
                this._ffmpegCommand = null;
                reject("cannot play video " + e.message);
            }
        })
    }
}

