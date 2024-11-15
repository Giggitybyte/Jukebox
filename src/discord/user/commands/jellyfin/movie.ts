import { BaseItemDto, BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import { Message, ThreadChannel } from "discord.js-selfbot-v13";
import { jellyfinApi } from "../../../../jellyfin/jellyfinApi";
import { DiscordUser } from "../../discordUser";
import { convertTicks } from "../../../../util";

export async function movieOverview(discord: DiscordUser, msg: Message, movie: BaseItemDto) {
    await msg.channel.sendTyping();

    let server = jellyfinApi.servers.get(movie.ServerId!)!;
    let duration = convertTicks(movie.RunTimeTicks!);

    let overview = `**${movie.Name}**\n`;
    if (movie.OriginalTitle != null && movie.OriginalTitle !== movie.Name) {
        overview += `*${movie.OriginalTitle}*\n`;
    }

    if (movie.Overview) {
        overview += "```asciidoc\n"
            + `${movie.Overview}\n`
            + "```\n"
    }

    overview += "```asciidoc\n"
        + "Release Year :: " + (movie.ProductionYear ?? "Unknown") + '\n'
        + `Duration :: ${duration.hours} hours ${duration.minutes} minutes\n`
        + `Resolution :: ${movie.Width}x${movie.Height}\n`
        + "Source :: " + server.name + "\n"
        + "```\n";

    overview += "```asciidoc\n"
        + "Audio Tracks ::"

    overview += "*Add any reaction to this message to begin streaming this movie*";

    let overviewMsg = await msg.channel.send(overview);
    discord.gatewayClient.on('messageReactionAdd', async (reaction, user) => {
        if (reaction.message.id !== overviewMsg.id || user.voice?.channel == null) return;

        let video = await jellyfinApi.getItem(movie.ServerId!, movie.Id!);
        if (video == undefined || (video.Type != BaseItemKind.Movie)) {
            console.warn(`Jellyfin movie overview ${overviewMsg.id} contained deleted/unavailable movie ${movie.Name!}`);
            return;
        }

        let videoTitle = (video.Name!.length > 100) ? `${video.Name!.substring(0, 100)}...` : video.Name;
        discord.setStatus('📺', `Streaming ${videoTitle}`);

        let videoUrl = await jellyfinApi.getVideoStreamUrl(video.ServerId!, video.Id!);
        discord.streamVideo(videoUrl, msg.guild!.id, user.voice!.channelId!);

        await (msg.channel as ThreadChannel).setArchived(true);
    });
}