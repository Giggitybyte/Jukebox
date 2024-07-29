// commands
import { helpCommand } from "./commands/help.js";
import { jellyfinCommand } from "./commands/jellyfin.js";
import { youtubeCommand } from "./commands/youtube.js";
import { torrentCommand } from "./commands/torrent.js";
import { volumeCommand } from "./commands/volume.js";
import { disconnectCommand } from "./commands/disconnect.js";

// libraries
import { Client, CustomStatus } from "discord.js-selfbot-v13";
import { AudioStream, H264NalSplitter, MediaUdp, Streamer, VideoStream } from "@dank074/discord-video-stream";
import { StreamOutput } from '@dank074/fluent-ffmpeg-multistream-ts';
import ffmpeg, { FfmpegCommand } from "fluent-ffmpeg";
import prism from "prism-media";
import { Readable } from "stream";
import validUrl from 'valid-url';
import { setTimeout } from "timers/promises";


/** Wrapper class for interacting with Discord and livestreaming video to a voice channel. */
export class Discord {
    private _discordClient: Client;
    private _streamClient: Streamer;
    private _ffmpegCommand: FfmpegCommand | null
    private _volumeTranformer: prism.VolumeTransformer | null;

    public get gatewayClient() {
        return this._discordClient;
    }

    public get streamClient() {
        return this._streamClient;
    }

    public get streamVolume() {
        return (this._volumeTranformer?.volume ?? 1) * 100;
    }

    public set streamVolume(percentage: number) {
        if (this._volumeTranformer == null) return;
        this._volumeTranformer.setVolume(percentage > -1 ? percentage / 100 : 1);
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
                helpCommand(this, msg, args);
            } else if (msg.author.voice?.channelId == null) {
                return;
            } else if (cmd === "volume") {
                volumeCommand(this, msg, args);
            } else if (cmd === "disconnect" || cmd === "stop") {
                disconnectCommand(this, msg, args);
            } else if (args.length == 0) {
                return;
            } else if (cmd === "youtube") {
                youtubeCommand(this, msg, args);
            } else if (cmd === "jellyfin") {
                jellyfinCommand(this, msg, args);
            } else if (cmd === "torrent") {
                torrentCommand(this, msg, args);
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

    public setIdleStatus() {
        let status = new CustomStatus(this._discordClient)
            .setEmoji('💿')
            .setState('Spinning around...'); // TODO: random idle status

        this._discordClient.user!.setPresence({
            status: "idle",
            activities: [status]
        });

        // TODO: add idle video streamed from a local file
        // HOME - Resonance on loop with "Waiting for media selection" text
    }

    public async streamVideo(video: string | Readable, guildId: string, channelId: string) {
        if (this._streamClient.voiceConnection?.streamConnection != undefined) {
            this.closeStream();
            await setTimeout(1500);
        }

        let udpConnection = await this.createLiveStreamConnection(guildId, channelId);
        udpConnection.mediaConnection.setSpeaking(true);
        udpConnection.mediaConnection.setVideoStatus(true);

        console.log(`Started streaming in guild ${guildId}; voice channel ${channelId}`);
        await this.streamToDiscord(video, udpConnection)
            .then(msg => {
                console.log(`Finished streaming in guild ${guildId} (${msg})`);
            })
            .catch(e => console.error(`Something went wrong while streaming in guild ${guildId}: ${e.message}`))
            .finally(async () => {
                await setTimeout(1500);
                await this.closeStream();
                this.setIdleStatus();
            });
    }

    public async closeStream(): Promise<boolean> {
        let stream = this._streamClient.voiceConnection?.streamConnection;
        if (stream == undefined) return false;

        this._ffmpegCommand?.kill("SIGINT");
        stream.setSpeaking(false);
        stream.setVideoStatus(false);
        this._streamClient.stopStream();
        this._streamClient.leaveVoice();

        console.log("Disconnected from voice channel.")
        return true
    }

    private async createLiveStreamConnection(guildId: string, channelId: string): Promise<MediaUdp> {
        if (this.streamClient.voiceConnection?.channelId !== channelId) {
            this.streamClient.leaveVoice();
        }

        await this.streamClient.joinVoice(guildId, channelId);

        // TODO: detect guild nitro level and try to stream at higher qualities.
        let udpConnection = await this.streamClient.createStream({
            width: 1280,
            height: 720,
            bitrateKbps: 4000,
            maxBitrateKbps: 4000,
            videoCodec: "H264",
            readAtNativeFps: false,
            h26xPreset: 'medium'
        });

        return udpConnection;
    }

    private async createWebcamConnection(guildId: string, channelId: string) {
        // TODO: audio-only support
        // display audio visualizer through webcam 
    }

    private streamToDiscord(input: string | Readable, udpConnection: MediaUdp) {
        return new Promise<string>((resolve, reject) => {
            try {
                let streamOpts = udpConnection.mediaConnection.streamOptions;

                this._ffmpegCommand = ffmpeg(input)
                    .addOption('-loglevel', '0')
                    .addOption('-fflags', 'nobuffer')
                    .addOption('-analyzeduration', '0')
                    .on('end', () => {
                        this._ffmpegCommand = null;
                        resolve("Stream end.")
                    })
                    .on("error", (err, stdout, stderr) => {
                        this._ffmpegCommand = null;
                        reject('Unable to stream: ' + err)
                    })
                    .on('stderr', console.error);


                // Video
                let videoStream = new VideoStream(udpConnection, streamOpts.fps, streamOpts.readAtNativeFps);
                let videoOutput = new H264NalSplitter();
                this._ffmpegCommand.output(StreamOutput(videoOutput).url, { end: false })
                    .noAudio()
                    .videoFilter(`scale=w=${streamOpts.width}:h=${streamOpts.height}:force_original_aspect_ratio=decrease:force_divisible_by=2`)
                    .fpsOutput(streamOpts.fps ?? 30)
                    .videoBitrate(`${streamOpts.bitrateKbps}k`)
                    .format('h264')
                    .outputOptions([
                        '-tune zerolatency',
                        '-pix_fmt yuv420p',
                        `-preset ${streamOpts.h26xPreset}`,
                        '-profile:v baseline',
                        `-g ${streamOpts.fps ?? 30}`,
                        `-bf 0`,
                        `-x264-params keyint=${streamOpts.fps}:min-keyint=${streamOpts.fps}`,
                        '-bsf:v h264_metadata=aud=insert'
                    ]);

                videoOutput.pipe(videoStream, { end: false });

                // Audio
                let audioStream: AudioStream = new AudioStream(udpConnection);
                let audioOutput = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
                this._volumeTranformer = new prism.VolumeTransformer({ type: 's16le', volume: 1 });
                this._volumeTranformer.pipe(audioOutput);

                this._ffmpegCommand.output(StreamOutput(this._volumeTranformer).url, { end: false })
                    .noVideo()
                    .audioChannels(2)
                    .audioFrequency(48000)
                    .format('s16le');

                audioOutput.pipe(audioStream, { end: false });

                // Additional flags
                if (streamOpts.hardwareAcceleratedDecoding) this._ffmpegCommand.inputOption('-hwaccel', 'auto');
                if (streamOpts.readAtNativeFps) this._ffmpegCommand.inputOption('-re');

                if (typeof input === "string" && validUrl.isWebUri(input as string)) {
                    let headers = {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.3",
                        "Connection": "keep-alive"
                    }

                    this._ffmpegCommand.inputOption('-headers', Object.keys(headers)
                        .map(key => key + ": " + headers[key])
                        .join("\r\n"));

                    if (input.includes('m3u') || input.includes('m3u8')) {
                        this._ffmpegCommand.inputOptions([
                            '-reconnect 1',
                            '-reconnect_at_eof 1',
                            '-reconnect_streamed 1',
                            '-reconnect_delay_max 4294',
                            '-bsf:a aac_adtstoasc'
                        ]);
                    }
                }

                // Start streaming video
                this._ffmpegCommand.run();

            } catch (e) {
                this._ffmpegCommand = null;
                reject("FFmpeg exited prematurely: " + e.message);
            }
        })
    }
}

export const discord = new Discord();