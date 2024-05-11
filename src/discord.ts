// commands
import { jellyfinCommand } from "./commands/jellyfin/jellyfin.js";
import { youtubeCommand } from "./commands/youtube.js";
import { disconnectCommand } from "./commands/disconnect.js";

// libraries
import { Client, CustomStatus, Guild, VoiceBasedChannel } from "discord.js-selfbot-v13";
import { AudioStream, H264NalSplitter, MediaUdp, Streamer, VideoStream } from "@dank074/discord-video-stream";
import { StreamOutput } from '@dank074/fluent-ffmpeg-multistream-ts';
import ffmpeg, { FfmpegCommand, AudioVideoFilter } from "fluent-ffmpeg";
import prism from "prism-media";
import { Readable } from "stream";
import validUrl from 'valid-url';

/** Wrapper class for interacting with Discord and livestreaming video to a voice channel. */
export class Discord {
    private _discordClient: Client;
    private _streamClient: Streamer;
    private _ffmpegCommand: FfmpegCommand | null

    public get streamClient() {
        return this._streamClient;
    }

    public get gatewayClient() {
        return this._discordClient;
    }

    public get ffmpeg() {
        return this._ffmpegCommand;
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

    public setIdleStatus() {
        let status = new CustomStatus(this._discordClient)
            .setEmoji('💿')
            .setState('Spinning around...'); // TODO: random idle status

        this._discordClient.user!.setPresence({
            status: "idle",
            activities: [status]
        });

        // TODO: add idle video streamed from a local file
    }

    public async createStreamConnection(guildId: string, channelId: string): Promise<MediaUdp> {
        if (this.streamClient.voiceConnection?.channelId !== channelId) {
            this.streamClient.leaveVoice();
        }

        await this.streamClient.joinVoice(guildId, channelId);

        // TODO: detect guild nitro level and try to stream at higher qualities.
        let udpConnection = await this.streamClient.createStream({
            width: 1280,
            height: 720,
            bitrateKbps: 6000,
            maxBitrateKbps: 6000,
            videoCodec: "H264",
            readAtNativeFps: true,
            h26xPreset: 'ultrafast'
        });

        return udpConnection;
    }

    public async playVideo(video: string | Readable, guildId: string, channelId: string) {
        if (this._streamClient.voiceConnection?.streamConnection != undefined) {
            this.closeStream();

            await new Promise<void>((resolve, reject) => {
                setTimeout(() => resolve(), 1500);
            });
        }

        let udpConnection = await this.createStreamConnection(guildId, channelId);
        udpConnection.mediaConnection.setSpeaking(true);
        udpConnection.mediaConnection.setVideoStatus(true);

        console.log(`Started streaming in guild ${guildId}; voice channel ${channelId}`);
        await this.streamVideo(video, udpConnection)
            .then(msg => {
                console.log(`Finished streaming in guild ${guildId} (${msg})`);
            })
            .catch(e => console.error(`Something went wrong while streaming in guild ${guildId}: ${e.message}`))
            .finally(async () => {
                await new Promise<void>((resolve, reject) => {
                    setTimeout(() => resolve(), 1500);
                });

                await this.closeStream();
                this.setIdleStatus();
            });
    }

    public async playAudio(audio: string | Readable, guildId: string, channelId: string) {
        // TODO: stream audio through voice connection, stream audio visualizer video through webcam
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

    private streamVideo(input: string | Readable, udpConnection: MediaUdp) {
        return new Promise<string>((resolve, reject) => {
            let streamOpts = udpConnection.mediaConnection.streamOptions;
            let videoStream = new VideoStream(udpConnection, streamOpts.fps, streamOpts.readAtNativeFps);

            try {
                this._ffmpegCommand = ffmpeg(input)
                    .addOption('-loglevel', '0')
                    .addOption('-fflags', 'nobuffer')
                    .addOption('-analyzeduration', '0')
                    .on('end', () => {
                        this._ffmpegCommand = null;
                        resolve("Stream completed.")
                    })
                    .on("error", (err, stdout, stderr) => {
                        this._ffmpegCommand = null;
                        reject('Unable to stream: ' + err)
                    })
                    .on('stderr', console.error);

                let videoOutput = new H264NalSplitter();
                this._ffmpegCommand.output(StreamOutput(videoOutput).url, { end: false })
                    .noAudio()
                    .videoFilter("scale=w=1280:h=720:force_original_aspect_ratio=increase:force_divisible_by=2")
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

                let audioStream: AudioStream = new AudioStream(udpConnection);
                let opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });

                this._ffmpegCommand.output(StreamOutput(opus).url, { end: false })
                    .noVideo()
                    .audioChannels(2)
                    .audioFrequency(48000)
                    .format('s16le');

                opus.pipe(audioStream, { end: false });

                if (streamOpts.hardwareAcceleratedDecoding) this._ffmpegCommand.inputOption('-hwaccel', 'auto');
                if (streamOpts.readAtNativeFps) this._ffmpegCommand.inputOption('-re');

                if (typeof input === "string" && validUrl.isWebUri(input as string)) {
                    let headers = { // TODO: auth headers for jellyfin HLS
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

                this._ffmpegCommand.run();
            } catch (e) {
                this._ffmpegCommand = null;
                reject("FFmpeg exited prematurely: " + e.message);
            }
        })
    }
}

