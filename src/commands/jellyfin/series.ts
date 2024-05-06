import { jellyfinSdk } from "./jellyfin";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getItemsApi, getTvShowsApi } from "@jellyfin/sdk/lib/utils/api";
import { Message } from "discord.js-selfbot-v13";

export async function seriesOverview(msg: Message, series: BaseItemDto): Promise<BaseItemDto | undefined> {
    let server = jellyfinSdk.servers.get(series.ServerId!)!;
    let overview = "```asciidoc\n";
    let header = `${series.Name!} (Series)\n`;

    overview += header + '\n' + '='.repeat(header.length) + '\n';
    if (series.OriginalTitle != null) {

    } else {
        overview += '\n'
    }

    overview += (series.Overview ?? "* No description available.") + '\n\n'
    overview += "Release Year :: " + (series.ProductionYear ?? "Unknown") + '\n';
    overview += `Available Episodes :: ${series.RecursiveItemCount}\n`
    overview += "Source :: " + server.name + "\n\n";

    let seriesApi = getTvShowsApi(server.api);
    let seasonsResponse = await seriesApi.getSeasons({ seriesId: series.Id! });

    let seasonsHeader = "Available Seasons";
    overview += seasonsHeader + '\n' + '-'.repeat(seasonsHeader.length) + '\n';

    if (seasonsResponse.data.TotalRecordCount == 0) {
        overview += `* ${server.name} doesn't have any seasons for this series.\n`
        await msg.channel.send(overview);
        return;
    }

    let seasons = seasonsResponse.data.Items!;
    for (let i = 0; i < seasons.length; i++) {
        let season = seasons[i];

        overview += `[${i + 1}]:: ${(season.Name!.length > 40) ? `${season.Name!.substring(0, 40)} ...` : season.Name}\n`;
        overview += ` ╰─── ${season.ChildCount} episodes\n`
    }

    overview += "\n[Reply to this message with a number to view season episodes]\n```"

    let overviewMsg = await msg.channel.send(overview);
    let collectedMsgs = await msg.channel.awaitMessages({ // break this and below out into a function
        filter: (m: Message) => {
            return m.author.id === msg.author.id
                && m.reference?.messageId === overviewMsg.id
                && !Number.isNaN(parseInt(m.content));
        },
        max: 1,
        time: 180000
    });

    if (collectedMsgs.size == 0) return;

    let responseMsg = collectedMsgs.first()!;
    let selectedNumber = parseInt(responseMsg.content);
    let season = seasons[selectedNumber - 1];

    let itemsApi = getItemsApi(server.api);
    let itemsResponse = await itemsApi.getItems({ ids: [season.Id!] });
    return itemsResponse.data.Items![0];
}