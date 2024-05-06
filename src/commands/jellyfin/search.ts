import { JellyfinServer } from "../../jellyfin";
import { jellyfinSdk } from "./jellyfin";
import { BaseItemDto, SearchHint, BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import { getSearchApi, getTvShowsApi } from "@jellyfin/sdk/lib/utils/api";
import { Message } from "discord.js-selfbot-v13";

export async function searchResults(msg: Message, query: string): Promise<BaseItemDto | undefined> {
    let results: { server: JellyfinServer, result: SearchHint, seasons: number | null }[] = [];

    for (const [id, server] of jellyfinSdk.servers) {
        let searchApi = getSearchApi(server.api);
        let result = await searchApi.get({
            searchTerm: query,
            limit: 10,
            includeItemTypes: [BaseItemKind.Series, BaseItemKind.Movie]
        });

        for (let searchResult of result.data.SearchHints!) {
            if (searchResult.Type == BaseItemKind.Series) {
                let seriesApi = getTvShowsApi(server.api);
                let seasonsResponse = await seriesApi.getSeasons({ seriesId: searchResult.Id! });
                let seasonCount = seasonsResponse.data.TotalRecordCount!;

                if (seasonCount == 0) continue;
                results.push({ server: server, result: searchResult, seasons: seasonCount });
            } else {
                results.push({ server: server, result: searchResult, seasons: null });
            }
        }
    }

    results.sort((a, b) => a.result.Name!.localeCompare(b.result.Name!));

    let resultList: string = "```asciidoc\n";
    let header = `Results for '${query}' (${jellyfinSdk.servers.size} ${jellyfinSdk.servers.size == 1 ? "server" : "servers"})`;
    resultList += header + '\n' + '-'.repeat(header.length) + "\n\n";

    for (let i = 0; i < results.length; i++) {
        let { server, result, seasons } = results[i];

        if (result.Type! == BaseItemKind.Series) {
            resultList += `[${i + 1}]:: ${result.Name} {${result.ProductionYear}}\n`;
            resultList += ` ╰─── Series ─ ${seasons} ${seasons == 1 ? "season" : "seasons"} ─ ${server.name}\n\n`;
        } else if (result.Type! == BaseItemKind.Movie) {
            let duration = jellyfinSdk.convertTicks(result.RunTimeTicks!)
            resultList += `[${i + 1}]:: ${result.Name} {${result.ProductionYear}}\n`
            resultList += ` ╰─── Movie ─ ${duration.hours}h ${duration.minutes}m ─ ${server.name}\n\n`
        } else {
            console.warn(`Got unexpected ${result.Type!} from Jellyfin search results.`)
        }
    }

    resultList += "[Reply to this message with a number to view a result]\n```"

    let resultListMsg = await msg.channel.send(resultList);
    let collectedMsgs = await msg.channel.awaitMessages({
        filter: (m: Message) => {
            return m.author.id === msg.author.id
                && m.reference?.messageId === resultListMsg.id
                && !Number.isNaN(parseInt(m.content));
        },
        max: 1,
        time: 180000
    });

    if (collectedMsgs.size == 0) return;
    let responseMsg = collectedMsgs.first()!;
    let selectedNumber = Number(responseMsg.content);
    let { server, result } = results[selectedNumber - 1];

    return await jellyfinSdk.getItem(server.id, result.Id!);
}