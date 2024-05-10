import { BaseItemDto, BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import { Message } from "discord.js-selfbot-v13";
import { Discord } from "../../discord";
import { jellyfinSdk } from "../../jellyfin";

export async function episodeOverview(discord: Discord, msg: Message, episode: BaseItemDto) {
    await msg.channel.sendTyping();

    let server = jellyfinSdk.servers.get(episode.ServerId!)!;
    let duration = jellyfinSdk.convertTicks(episode.RunTimeTicks!);

    let overview = `${episode.SeriesName}\n${episode.SeasonName}\n**${episode.Name}**\n`;

    if (episode.Overview) {
        overview += "```asciidoc\n"
            + `${episode.Overview}\n`
            + "```\n";
    }

    overview += "```asciidoc\n"
        + "Release Date :: " + (episode.PremiereDate ?? episode.ProductionYear) + '\n'
        + `Duration :: ${(duration.hours > 0 ? `${duration.hours} hours ` : '') + `${duration.minutes} minutes`}\n`
        + `Resolution :: ${episode.Width}x${episode.Height}\n`
        + "Source :: " + server.name + "\n"
        + "```\n";

    overview += "*Add any reaction to this message to begin streaming this episode*";

    let overviewMsg = await msg.reply(overview);

    discord.gatewayClient.on('messageReactionAdd', async (reaction, user) => {
        if (reaction.message.id !== overviewMsg.id || user.voice?.channel == null) return;

        let video = await jellyfinSdk.getItem(episode.ServerId!, episode.Id!);
        if (video == undefined || video.Type != BaseItemKind.Episode) {
            console.warn(`Jellyfin episode overview ${overviewMsg.id} contained deleted/unavailable episode ${episode.IndexNumber}`);
            return;
        };

        let videoTitle = (video.Name!.length > 100) ? `${video.Name!.substring(0, 100)}...` : video.Name;
        discord.setStatus('📺', `Streaming: ${videoTitle}`);

        let videoUrl = await jellyfinSdk.getVideoStreamUrl(video.ServerId!, video.Id!);
        discord.playVideo(videoUrl, msg.guild!.id, user.voice!.channelId!);
    });

}