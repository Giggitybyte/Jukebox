import { discordBot } from "./bot/discordBot";
import { discordUser } from "./user/discordUser";

import internal from "stream";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import { jellyfinApi } from "../jellyfin/jellyfinApi";
import { Events } from "discord.js";
import ytdl from "@distube/ytdl-core";

export class MediaManager {
    public currentVideo: Media | null;
    public currentAudio: Media | null;
    public videoQueue: Media[];
    public audioQueue: Media[];

    constructor() {
        discordUser.streamEvents.on("liveStreamStart", this.onVideoStart);
        discordUser.streamEvents.on("liveStreamEnd", this.onVideoEnd);
        discordUser.streamEvents.on("cameraStreamStart", this.onAudioStart);
        discordUser.streamEvents.on("cameraStreamEnd", this.onAudioEnd);

        discordUser.gatewayClient.on("voiceStateUpdate", (oldState, newState) => {
            if(newState.user?.id !== discordUser.gatewayClient.user?.id) return;

            if (oldState.channel && newState.channel) {
                // channel move
                // restart stream in new channel
            } else if (newState.channel) {
                // start audio queue 
                // start video queue 
            } else {
                // stop audio queue 
                // stop video queue 
            }
        });

        discordBot.gatewayClient.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isButton()) return;

            let userVoiceState = await interaction.guild!.voiceStates.fetch(interaction.user.id);

            if (userVoiceState == undefined || userVoiceState.channelId == null) {
                await interaction.reply({ content: "⚠️ Please join a voice channel before streaming.", ephemeral: true });
                return;
            }

            if (interaction.customId.startsWith("ytv")) {
                let url = interaction.customId.substring(0, 5);
                let videoInfo = await ytdl.getInfo(url);

                this.enqueueVideo({
                    id: videoInfo.videoDetails.videoId,
                    title: videoInfo.videoDetails.title
                } as YouTubeVideo)


            } else if (interaction.customId.startsWith("jfe")) {

            }
        })
    }


    public enqueueVideo(media: Media) {
        if (this.currentVideo == null && this.videoQueue.length == 0) {
            this.currentVideo = media;
            this.streamVideo(media);
        } else {
            this.videoQueue.push(media);
        }
    }

    public enqueueAudio(media: Media) {
        if (this.currentAudio == null && this.audioQueue.length == 0) {
            this.currentAudio = media;
        } else {
            this.audioQueue.push(media);
        }
    }


    private async onVideoStart() {
        // Set status for bot and user.
        if (this.currentVideo instanceof JellyfinMedia) {
            let item = await jellyfinApi.getItem(this.currentVideo.serverId, this.currentVideo.id);

            if (item.Type! == BaseItemKind.Episode) {
                let seriesTitle = (item.SeriesName!.length > 50) ? `${item.SeriesName!.substring(0, 50)}...` : item.SeriesName;
                let suffix = "";

                if (item.ParentIndexNumber) suffix += `S${item.ParentIndexNumber}`
                if (item.IndexNumber) suffix += `E${item.IndexNumber}`

                discordUser.setStatus('📺', `Streaming ${seriesTitle} ${suffix}`);
            } else if (item.Type! == BaseItemKind.Movie) {
                let title = (item.Name!.length > 50) ? `${item.Name!.substring(0, 50)}...` : item.Name;
                discordUser.setStatus('🎥', `Streaming ${title}`);
            }

            discordBot.setStatus()
        }
    }

    private onVideoEnd() {
        // if queue empty or voice channel null, set idle status then return
        // if current is null, pull pop queue and set as current
        // stream current
    }

    private onAudioStart() {

    }

    private onAudioEnd() {

    }

    private async streamVideo(media: Media) {
        let video: string | internal.Readable;

        if (media instanceof JellyfinMedia) {
            let item = await jellyfinApi.getItem(media.serverId, media.id);
            if (item == undefined || (item.Type != BaseItemKind.Episode && item.Type != BaseItemKind.Movie)) {
                console.warn(`Invalid item type. Expected Episode or Movie, got ${item.Type}`);
                return;
            };





            let videoUrl = await jellyfinApi.getVideoStreamUrl(item.ServerId!, item.Id!);
            discordUser.streamVideo(videoUrl, msg.guild!.id, user.voice!.channelId!);

        } else if (media instanceof YouTubeVideo) {

        } else {
            throw new Error("Invalid media type.")
        }

        await discordUser.streamVideo(videoUrl, msg.guild!.id, user.voice!.channelId!);
    }

    private async streamAudio(media: Media) {

    }
}

export abstract class Media {
    public source: 'Jellyfin' | 'Youtube' | 'Subsonic';
    public id: string;
    public title: string;
    public duration: number;
}

export class YouTubeVideo extends Media {
    public thumbnailUrl: string;
    public channelName: string;
    public channelUrl: string;

    constructor() {
        super();
        this.source = 'Youtube';
    }
}

export class JellyfinMedia extends Media {
    public serverId: string;
    public imageUrl: string;
    public bannerUrl: string;
    public type: BaseItemKind;

    constructor() {
        super();
        this.source = 'Jellyfin';
    }
}

export class SubsonicAudio extends Media {
    public albumName: string;
    public artistName: string;

    constructor() {
        super();
        this.source = 'Subsonic';
    }
}