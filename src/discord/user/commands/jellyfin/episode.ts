import { BaseItemDto, BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import { Message, ThreadChannel } from "discord.js-selfbot-v13";
import { DiscordUser } from "../../discordUser";
import { jellyfinApi } from "../../../../jellyfin/jellyfinApi";
import { convertTicks } from "../../../../util";

export async function episodeOverview(discord: DiscordUser, msg: Message, episode: BaseItemDto) {
    await msg.channel.sendTyping();

    let server = jellyfinApi.servers.get(episode.ServerId!)!;
    let duration = convertTicks(episode.RunTimeTicks!);

    let overview = `${episode.SeriesName}\n${episode.SeasonName}\n**${episode.Name}**\n`;

    if (episode.Overview) {
        overview += "```asciidoc\n"
            + `${episode.Overview}\n`
            + "```\n";
    }

    overview += "```asciidoc\n"
        + "Release Date :: " + (episode.PremiereDate != null ? new Date(episode.PremiereDate).toLocaleDateString("en-US") : episode.ProductionYear) + '\n'
        + `Duration :: ${(duration.hours > 0 ? `${duration.hours} hours ` : '') + `${duration.minutes} minutes`}\n`
        + `Resolution :: ${episode.Width}x${episode.Height}\n`
        + "Source :: " + server.name + "\n"
        + "```\n";

    overview += "*Add any reaction to this message to begin streaming this episode*";

    let overviewMsg = await msg.channel.send(overview);

    discord.gatewayClient.on('messageReactionAdd', async (reaction, user) => {
        if (reaction.message.id !== overviewMsg.id || user.voice?.channel == null) return;

        let video = await jellyfinApi.getItem(episode.ServerId!, episode.Id!);
        if (video == undefined || video.Type != BaseItemKind.Episode) {
            console.warn(`Jellyfin episode overview ${overviewMsg.id} contained deleted/unavailable episode ${episode.IndexNumber}`);
            return;
        };

        let seriesTitle = (video.SeriesName!.length > 60) ? `${video.SeriesName!.substring(0, 60)}...` : video.SeriesName;
        discord.setStatus('📺', `Streaming ${seriesTitle} S${video.ParentIndexNumber}E${video.IndexNumber}`);

        let videoUrl = await jellyfinApi.getVideoStreamUrl(video.ServerId!, video.Id!);
        discord.streamVideo(videoUrl, msg.guild!.id, user.voice!.channelId!);

        await (msg.channel as ThreadChannel).setArchived(true);
    });

}