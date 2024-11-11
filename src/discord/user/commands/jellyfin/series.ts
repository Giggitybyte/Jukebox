import { seasonOverview } from "./season";
import { DiscordUser } from "../../discordUser";
import { jellyfinApi } from "../../../../jellyfin/jellyfinApi";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api";
import { Message } from "discord.js-selfbot-v13";


export async function seriesOverview(discord: DiscordUser, msg: Message, series: BaseItemDto): Promise<BaseItemDto | undefined> {
    await msg.channel.sendTyping();

    let server = jellyfinApi.servers.get(series.ServerId!)!;
    let seriesApi = getTvShowsApi(server.api);
    let seasonsResponse = await seriesApi.getSeasons({ seriesId: series.Id! });
    let seasons: { season: BaseItemDto, episodes: BaseItemDto[] }[] = [];

    for (let season of seasonsResponse.data.Items!) {
        let { data: { Items: episodes } } = await seriesApi.getEpisodes({ seriesId: series.Id!, seasonId: season.Id! });
        seasons.push({ season: season, episodes: episodes! });
    }

    let overview = `**${series.Name}**\n`;
    if (series.OriginalTitle != null && series.OriginalTitle !== series.Name) {
        overview += `*${series.OriginalTitle}*\n`;
    }

    if (series.Overview) {
        overview += "```asciidoc\n"
            + `${series.Overview}\n`
            + "```\n";
    }

    overview += "```asciidoc\n"
        + `Release Year :: ${series.ProductionYear}\n`
        + `Available Episodes :: ${seasons.map(item => item.episodes.length).reduce((prev, next) => prev + next)}\n`
        + `Source :: ${server.name}\n`
        + "```\n";

    if (seasons.length == 0) {
        await msg.channel.send(overview);
        return;
    }

    overview += "**Available Seasons**\n```asciidoc\n";
    for (let i = 0; i < seasons.length; i++) {
        let { season, episodes } = seasons[i];

        overview += `[${i + 1}]:: ${(season.Name!.length > 60) ? `${season.Name!.substring(0, 60)}...` : season.Name}\n`;
        overview += ` ╰─── ${episodes.length} episodes\n\n`;
    }
    overview += "```\n*Reply to this message with a number to view season episodes*"

    let overviewMsg = await msg.channel.send(overview);
    discord.gatewayClient.on('messageCreate', async (m) => {
        let validReply: boolean = m.reference?.messageId === overviewMsg.id
            && Number.isNaN(parseInt(m.content)) === false
            && m.author.voice?.channel != null;

        if (validReply == false) return;

        let selectedNumber = Number(m.content);
        let { season } = seasons[selectedNumber - 1];
        let selectedSeason = await jellyfinApi.getItem(season.ServerId!, season.Id!);

        if (selectedSeason == undefined) {
            console.warn(`Jellyfin series overview ${overviewMsg.id} contained deleted/unavailable season ${season.IndexNumber} ${series.Name!}`);
            await m.react('⚠️').catch(() => { });
            return;
        }

        seasonOverview(discord, m, selectedSeason);
    });
}