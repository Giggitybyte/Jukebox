import express from 'express';
import { discordUser } from "./discordUser";
import { jellyfinApi } from "../../jellyfin/jellyfinApi";
import { GuildTextBasedChannel, Message, TextChannel } from "discord.js-selfbot-v13";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { jellyfinChannelId } from "../../../config/discord.json"
import { randomInt } from 'crypto';
import { convertTicks } from '../../util';

// Discord channel wrapper which contains the combined media library of all Jellyfin servers.
// Automatically updates when new content is available by listening for a POST request from each Jellyfin server.
class JellyfinChannel {
    private discordChannel: GuildTextBasedChannel;
    private jellyfinWebhook: express.Application; // TODO: set this up. if media is known, delete existing thread then delete message.
    private mediaMessages = new Map<string, MediaInfo>(); // message id -> movie/series

    constructor() {
        discordUser.gatewayClient.on('messageReactionAdd', (reaction, user) => {
            if (!this.mediaMessages.has(reaction.message.id)) return;

            // select best quality
            // choose at random if all servers have the same quality
            // play media
        });
    }

    public async initialize() {
        this.discordChannel = await discordUser.gatewayClient.channels.fetch(jellyfinChannelId) as TextChannel;

        let items = new Map<string, BaseItemDto[]>();
        let availableMedia: MediaInfo[] = [];

        for (const serverId of jellyfinApi.servers.keys()) {
            let serverItems: BaseItemDto[] = await jellyfinApi.getItems(serverId, ['Movie', 'Series']);
            items.set(serverId, serverItems);

            for (let item of serverItems) {
                let itemProviders = Object.entries(item.ProviderIds!)
                    .map(ip => { return { name: ip[0], id: ip[1] } })
                    .filter(ip => ip.name !== "TmdbCollection");

                let mediaIndex = availableMedia.findIndex(media => {
                    return media.metadataIds.some(mediaProvider => {
                        for (const itemProvider of itemProviders) {
                            let match = (mediaProvider.name === itemProvider.name && mediaProvider.id === itemProvider.id);
                            if (match) return true;
                        }

                        return false;
                    });
                });

                if (mediaIndex !== -1) {
                    let existingMedia = availableMedia[mediaIndex];
                    let existingProviders = existingMedia.metadataIds;
                    let metadataProviders = [...existingProviders, ...itemProviders].filter((value, index, self) => {
                        return self.findIndex(v => v.id === value.id && v.name === value.name) === index;
                    });

                    existingMedia.metadataIds = metadataProviders;
                    existingMedia.servers.push({ serverId: serverId, itemId: item.Id! });

                    availableMedia[mediaIndex] = existingMedia;
                } else {
                    availableMedia.push({
                        name: item.Name!,
                        type: item.Type!,
                        metadataIds: itemProviders,
                        servers: [{ serverId: serverId, itemId: item.Id! }]
                    });
                }
            }
        }

        // Output all known media to channel
        for (let media of availableMedia) {
            let index = media.servers.length - 1 > 0 ? randomInt(0, media.servers.length - 1) : 0;
            let mediaSource = media.servers[index];
            let item = items.get(mediaSource.serverId)!.find(i => i.Id! === mediaSource.itemId)!;

            let overviewMsg: Message = await this.discordChannel.send({
                content: `# ${item.Name!}\n` + "```\n" + (item.Overview ?? "No description.") + "\n```",
                files: [{
                    attachment: jellyfinApi.getItemImageUrl(item.ServerId!, item.Id!),
                    name: 'image.png'
                }],
            });

            this.mediaMessages.set(overviewMsg.id, media)
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Display available servers
            let thread = await overviewMsg.startThread({ name: `${item.Name!} (${item.ProductionYear})` });
            let text = `Available from ${media.servers.length} ${media.servers.length === 1 ? 'server' : 'servers'}\n`;
            await new Promise(resolve => setTimeout(resolve, 2500));

            for (let index = 0; index < media.servers.length; index++) {
                let serverInfo = media.servers[index];
                let server = jellyfinApi.servers.get(serverInfo.serverId)!;
                let serverItem = items.get(serverInfo.serverId)!.find(i => i.Id! === serverInfo.itemId)!;

                let duration = convertTicks(serverItem.RunTimeTicks!);
                let audioTracks: number = serverItem.MediaStreams!.filter(s => s.Type == 'Audio').length;
                let subtitleTracks: number = serverItem.MediaStreams!.filter(s => s.Type == 'Subtitle').length;

                text += "```asciidoc\n" +
                    `[${index + 1}]:: ${server.name}\n` +
                    `* ${serverItem.Width}x${serverItem.Height}\n` +
                    `* ${(duration.hours > 0 ? `${duration.hours} hours ` : '') + `${duration.minutes} minutes`}\n` +
                    `* ${audioTracks} Audio ${audioTracks === 1 ? "Track" : "Tracks"}\n` +
                    `* ${subtitleTracks} Subtitle ${subtitleTracks === 1 ? "Track" : "Tracks"}\n` +
                    "```\n";
            }

            text += "*Reply to this message with a number to select a server*";

            let serversMsg = await thread.send(text);
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5000));

            // add event listener 
        }
    }
}

interface MediaInfo {
    name: string;
    type: string;
    metadataIds: { name: string, id: string }[];
    servers: { serverId: string, itemId: string }[];

}

export const jellyfinChannel = new JellyfinChannel();