import { episodeOverview } from "./episode";
import { movieOverview } from "./movie";
import { searchResults } from "./search";
import { seasonOverview } from "./season";
import { seriesOverview } from "./series";
import { JellyfinSdk } from "../../jellyfin";
import { Discord } from "../../discord";
import { Message } from "discord.js-selfbot-v13";
import { MediaUdp } from "@dank074/discord-video-stream";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import validUrl from 'valid-url';

export const jellyfinSdk = new JellyfinSdk();

export async function jellyfinCommand(discord: Discord, msg: Message, args: string[]) {
    let selectedItemId: string | null = null;
    let sourceServerId: string | null = null;
    let itemOverviewMsg: Message | null = null;

    await msg.channel.sendTyping();

    if (validUrl.isWebUri(args[0])) {
        await msg.react('🔗').catch(() => { });
        let url: string = args[0];
        let paramIndex = url.indexOf("#!/details") + 10;
        let parameters = new URLSearchParams(url.substring(paramIndex))

        let itemId = parameters.get("id");
        let serverId = parameters.get("serverId");

        if (serverId != null && itemId != null && jellyfinSdk.servers.has(serverId)) {
            let server = jellyfinSdk.servers.get(serverId)!;
            let item = await jellyfinSdk.getItem(serverId, itemId);

            if (item == undefined || (item.Type != BaseItemKind.Movie && item.Type != BaseItemKind.Episode)) {
                await msg.react('❌').catch(() => { });
                return;
            }

            selectedItemId = item.Id!
            sourceServerId = server.id

            if (item.Type == BaseItemKind.Movie)
                itemOverviewMsg = await movieOverview(msg, item);
            else if (item.Type == BaseItemKind.Episode)
                itemOverviewMsg = await episodeOverview(msg, item);
        }
    } else {
        await msg.react('🔎').catch(() => { });
        let selectedItem = await searchResults(msg, args.join(' '));
        if (!selectedItem) return;

        if (selectedItem.Type! == BaseItemKind.Movie) {
            sourceServerId = selectedItem.ServerId!;
            selectedItemId = selectedItem.Id!;
            itemOverviewMsg = await movieOverview(msg, selectedItem);
        } else if (selectedItem.Type! == BaseItemKind.Series) {
            let selectedSeason = await seriesOverview(msg, selectedItem);
            if (!selectedSeason) return;

            let selectedEpisode = await seasonOverview(msg, selectedSeason);
            if (!selectedEpisode) return;

            sourceServerId = selectedEpisode.ServerId!;
            selectedItemId = selectedEpisode.Id!;
            itemOverviewMsg = await episodeOverview(msg, selectedEpisode);
        } else {
            console.warn(`Got unexpected ${selectedItem.Type!} from user selection.`);
        }
    }

    if (selectedItemId == null || sourceServerId == null || itemOverviewMsg == null) {
        await msg.react('⚠️').catch(() => { });
        return;
    }

    discord.gatewayClient.on('messageReactionAdd', async (reaction, user) => {
        if (reaction.message.id !== itemOverviewMsg.id || user.voice?.channel == null) return;

        let video = await jellyfinSdk.getItem(sourceServerId, selectedItemId);
        if (video == undefined || (video.Type != BaseItemKind.Movie && video.Type != BaseItemKind.Episode)) return;

        if (discord.streamClient.voiceConnection == null) {
            await discord.streamClient.joinVoice(msg.guild!.id, user.voice.channel.id);
        }

        let udpConnection: MediaUdp;
        if (discord.streamClient.voiceConnection!.streamConnection != null)
            udpConnection = discord.streamClient.voiceConnection!.streamConnection!.udp;
        else
            udpConnection = await discord.streamClient.createStream();

        let videoUrl = await jellyfinSdk.getVideoStreamUrl(sourceServerId, selectedItemId);
        let videoTitle = (video.Name!.length > 100) ? `${video.Name!.substring(0, 100)}...` : video.Name;
        discord.setStatus('🎦', `Streaming ${video.Type!}: ${videoTitle}`);

        discord.playVideo(videoUrl, udpConnection).catch(e => {
            console.error(`Something went wrong while streaming ${video.Id} from ${sourceServerId} in ${msg.guild!.id}\n${e}`);
        });;
    });
}


