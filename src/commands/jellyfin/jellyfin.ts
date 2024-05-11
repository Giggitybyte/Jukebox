import { movieOverview } from "./movie";
import { seriesOverview } from "./series";
import { Discord } from "../../discord";
import { jellyfinSdk, JellyfinServer } from "../../jellyfin";
import { Message } from "discord.js-selfbot-v13";
import { BaseItemDto, BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import { getSearchApi, getTvShowsApi } from "@jellyfin/sdk/lib/utils/api";
import validUrl from 'valid-url';


export async function jellyfinCommand(discord: Discord, msg: Message, args: string[]) {
    if (validUrl.isWebUri(args[0])) {
        await msg.react('🔗').catch(() => { });
        jellyfinUrl(discord, msg, args[0]);
    } else {
        jellyfinSearch(discord, msg, args.join(' '));
    }
}

async function jellyfinUrl(discord: Discord, msg: Message, url: string): Promise<BaseItemDto | undefined> {
    let paramIndex = url.indexOf("#!/details") + 10;
    let parameters = new URLSearchParams(url.substring(paramIndex))
    let itemId = parameters.get("id");
    let serverId = parameters.get("serverId");

    if (serverId == null || itemId == null || jellyfinSdk.servers.has(serverId) == false) {
        await msg.react('❌').catch(() => { });
        return;
    }

    let video = await jellyfinSdk.getItem(serverId, itemId);
    if (video == undefined || (video.Type != BaseItemKind.Movie && video.Type != BaseItemKind.Episode)) {
        await msg.react('❌').catch(() => { });
        return;
    } else {
        await msg.react('✅').catch(() => { });
    }

    let videoUrl = await jellyfinSdk.getVideoStreamUrl(video.ServerId!, video.Id!);
    let videoTitle = (video.Name!.length > 100) ? `${video.Name!.substring(0, 100)}...` : video.Name;
    discord.setStatus('📺', `Streaming: ${videoTitle}`);

    discord.playVideo(videoUrl, msg.guild!.id, msg.author.voice!.channelId!);
}

async function jellyfinSearch(discord: Discord, msg: Message, query: string) {
    await msg.react('🔎').catch(() => { });
    let searchThread = await msg.startThread({ name: `Jellyfin Search: '${query}'` });
    await searchThread.sendTyping();

    let results: { server: JellyfinServer, result: BaseItemDto, seasons: number | null }[] = [];
    for (const [id, server] of jellyfinSdk.servers) {
        let result = await getSearchApi(server.api).get({
            searchTerm: query,
            limit: 10,
            includeItemTypes: [BaseItemKind.Series, BaseItemKind.Movie]
        });

        for (let searchResult of result.data.SearchHints!) {
            let item = await jellyfinSdk.getItem(id, searchResult.Id!);
            if (searchResult.Type == BaseItemKind.Series) {
                let seasonsResponse = await getTvShowsApi(server.api).getSeasons({ seriesId: searchResult.Id! });
                let seasonCount = seasonsResponse.data.TotalRecordCount!;
                if (seasonCount == 0) continue;

                results.push({ server: server, result: item!, seasons: seasonCount });
            } else {
                results.push({ server: server, result: item!, seasons: null });
            }
        }
    }

    results.sort((a, b) => a.result.Name!.localeCompare(b.result.Name!));


    let resultList = `Results for **\`${query}\`** *(${jellyfinSdk.servers.size} ${jellyfinSdk.servers.size == 1 ? "server" : "servers"}*)\n`;
    resultList += "```asciidoc\n";

    for (let i = 0; i < results.length; i++) {
        let { server, result, seasons } = results[i];
        let resultTitle = result.Name!.includes(`(${result.ProductionYear})`)
            ? result.Name!.replace(`(${result.ProductionYear})`, '')
            : result.Name!;

        resultTitle = resultTitle.trim();
        if (resultTitle.length > 60) resultTitle = `${resultTitle.substring(0, 60)}...`

        if (result.Type! == BaseItemKind.Series) {
            resultList += `[${i + 1}]:: ${resultTitle} {${result.ProductionYear}}\n`;
            resultList += ` ╰─── Series ─ ${seasons} ${seasons == 1 ? "season" : "seasons"} ─ ${server.name}\n\n`;
        } else if (result.Type! == BaseItemKind.Movie) {
            resultList += `[${i + 1}]:: ${resultTitle} {${result.ProductionYear}}\n`
            resultList += ` ╰─── Movie ─ ${result.Width!}×${result.Height} ─ ${server.name}\n\n`
        } else {
            console.warn(`Got unexpected ${result.Type!} from Jellyfin search results.`)
        }
    }

    resultList += "\n```\n*Reply to this message with a number to view a result*";
    let resultListMsg = await searchThread.send(resultList);

    discord.gatewayClient.on('messageCreate', async (m) => {
        let validReply: boolean = m.reference?.messageId === resultListMsg.id
            && Number.isNaN(parseInt(m.content)) === false
            && m.author.voice?.channel != null;

        if (validReply == false) return;

        let selectedNumber = Number(m.content);
        let { server, result } = results[selectedNumber - 1];
        let selectedItem = await jellyfinSdk.getItem(server.id, result.Id!);

        if (selectedItem == undefined) {
            console.warn(`Jellyfin result message ${resultListMsg.id} contained deleted/unavailable ${result.Type?.toLowerCase()} ${result.Name} (${result.Id})`);
            await m.react('⚠️').catch(() => { });
            return;
        }

        if (selectedItem.Type! == BaseItemKind.Movie) {
            movieOverview(discord, m, selectedItem);
        } else if (selectedItem.Type! == BaseItemKind.Series) {
            seriesOverview(discord, m, selectedItem);
        } else {
            await m.react('⚠️').catch(() => { });
            console.warn(`Got unexpected ${selectedItem.Type!} from user selection of Jellyfin result from ${resultListMsg.id}.`);
        }
    });
}