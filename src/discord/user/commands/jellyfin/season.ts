import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Message } from "discord.js-selfbot-v13";
import { DiscordUser } from "../../discordUser";
import { jellyfinApi } from "../../../../jellyfin/jellyfinApi";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api";
import { episodeOverview } from "./episode";
import { convertTicks } from "../../../../util";

export async function seasonOverview(discord: DiscordUser, msg: Message, season: BaseItemDto) {
    await msg.channel.sendTyping();

    let server = jellyfinApi.servers.get(season.ServerId!)!;
    let seriesApi = getTvShowsApi(server.api);
    let { data: { Items } } = await seriesApi.getEpisodes({ seriesId: season.SeriesId!, seasonId: season.Id! });
    let episodes: BaseItemDto[] = [];

    for (let episode of Items!) {
        let item = await jellyfinApi.getItem(server.id, episode.Id!) as BaseItemDto;
       episodes.push(item);
    }

    let overview = `**${season.SeriesName}**\n` + `*${season.Name}*\n`;
    if (season.Overview) {
        overview += "```asciidoc\n"
            + `${season.Overview}\n`
            + "```\n";
    } else {
        overview += '\n';
    }

    overview += "**Available Episodes**\n```asciidoc\n";
    for (let i = 0; i < episodes!.length; i++) {
        let episode = episodes![i];
        let duration = convertTicks(episode.RunTimeTicks!);

        overview += `[${i + 1}]:: ${(episode.Name!.length > 60) ? `${episode.Name!.substring(0, 60)}...` : episode.Name}\n`;
        overview += " ╰─── " + (duration.hours > 0 ? `${duration.hours} hours ` : '') + `${duration.minutes} minutes\n\n`;
    }
    overview += "```\n*Reply to this message with a number to select an episode*"

    let overviewMsg = await msg.channel.send(overview);
    discord.gatewayClient.on('messageCreate', async (m) => {
        let validReply: boolean = m.reference?.messageId === overviewMsg.id
            && Number.isNaN(parseInt(m.content)) === false
            && m.author.voice?.channel != null;

        if (validReply == false) return;

        let selectedNumber = Number(m.content);
        let episode = episodes![selectedNumber - 1];
        let selectedEpisode = await jellyfinApi.getItem(episode.ServerId!, episode.Id!);

        if (selectedEpisode == undefined) {
            console.warn(`Jellyfin season overview ${overviewMsg.id} contained deleted/unavailable episode ${episode.IndexNumber}`);
            await m.react('⚠️').catch(() => { });
            return;
        }

        episodeOverview(discord, m, selectedEpisode);
    });
    
}