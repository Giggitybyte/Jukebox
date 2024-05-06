import { Client, CustomStatus, RichPresence } from "discord.js-selfbot-v13";
import { command, MediaUdp, Streamer, streamLivestreamVideo } from "@dank074/discord-video-stream";
import { youtubeCommand } from "./commands/youtube.js";
import { disconnectCommand } from "./commands/disconnect.js";
import { jellyfinCommand } from "./commands/jellyfin/jellyfin.js";
import { Readable } from "stream";

export class Discord { // TODO: add idle video streamed from a local file
    private _streamClient: Streamer;
    private _discordClient: Client;

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

    public setIdleStatus() {
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
    
        let udpConnection = await this.streamClient.createStream({
            width: 1280, 
            height: 720,
            bitrateKbps: 8000,
            maxBitrateKbps: 10000,
            videoCodec: "H264",
            h26xPreset: "slow"
        });
    
        return udpConnection;
    }
    
    public async playVideo(video: string | Readable, udpConn: MediaUdp) {
        udpConn.mediaConnection.setSpeaking(true);
        udpConn.mediaConnection.setVideoStatus(true);

        console.log(`Started streaming`);
        await streamLivestreamVideo(video, udpConn, true)
            .then(msg => {
                console.log(`Finished streaming (${msg})`);
            })
            .finally(async () => {
                udpConn.mediaConnection.setSpeaking(false);
                udpConn.mediaConnection.setVideoStatus(false);
    
                command?.kill("SIGINT");

                await new Promise<void>((resolve, reject) => {
                    setTimeout(() => resolve(), 1500);
                });
    
                this.streamClient.stopStream();
                this.streamClient.leaveVoice();

                this.setIdleStatus();
            });
    }
}

