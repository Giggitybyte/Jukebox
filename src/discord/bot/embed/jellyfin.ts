import { BaseItemDto, ImageType } from "@jellyfin/sdk/lib/generated-client/models";
import { blockQuote, EmbedBuilder, inlineCode, time, TimestampStyles } from "discord.js";
import { jellyfinApi } from "../../../jellyfin/jellyfinApi";
import TurndownService from 'turndown';

const jellyfinPurple = "#AA5CC3";
const htmlMarkdown = new TurndownService()

export function series(series: BaseItemDto, seasonCount: number): EmbedBuilder {
    let embed = new EmbedBuilder()
        .setColor(jellyfinPurple)
        .setTitle(series.Name!);

    if (series.OriginalTitle && series.OriginalTitle !== series.Name) {
        embed.setAuthor({ name: series.OriginalTitle })
    }

    if (series.Overview) {
        embed.setDescription(blockQuote(htmlMarkdown.turndown(series.Overview)));
    } else {
        embed.setDescription("*No description.*");
    }

    if (series.Genres) {
        embed.addFields({ name: "Genres", value: series.Genres.join(", ") });
    }

    if (series.PremiereDate) {
        let unixTimestamp: number = Date.parse(series.PremiereDate) / 1000;
        let discordTimestamp: string = time(unixTimestamp, TimestampStyles.LongDate);

        embed.addFields({ name: "Release Date", value: discordTimestamp, inline: true })
    } else if (series.ProductionYear) {
        embed.addFields({ name: "Release Year", value: series.ProductionYear.toString(), inline: true })
    }

    if (series.OfficialRating) {
        embed.addFields({ name: "Rating", value: inlineCode(series.OfficialRating), inline: true });
    }

    embed.addFields({ name: "Available Seasons", value: seasonCount.toString(), inline: true });

    let server = jellyfinApi.servers.get(series.ServerId!)!;
    embed.setFooter({ text: server.name });

    let imageType: ImageType;
    if (series.ImageTags && "Banner" in series.ImageTags) {
        imageType = ImageType.Banner;
    } else {
        imageType = ImageType.Primary;
    }

    let imageUrl = jellyfinApi.getItemImageUrl(series.ServerId!, series.Id!, imageType);
    embed.setImage(imageUrl);

    return embed;
}

export function season(season: BaseItemDto): EmbedBuilder {

}

export function episode(episode: BaseItemDto): EmbedBuilder {

}

export function movie(movie: BaseItemDto): EmbedBuilder {

}