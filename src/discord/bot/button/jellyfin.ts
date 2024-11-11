import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { ButtonBuilder, ButtonStyle } from "discord.js";

export function trailer(url: string): ButtonBuilder {
    return new ButtonBuilder()
    .setCustomId(`yt-v-${url}`)
    .setStyle(ButtonStyle.Success)
    .setLabel("Watch Trailer")
    .setEmoji("🎬");
}

export function episode(item: BaseItemDto): ButtonBuilder {
    return new ButtonBuilder()
    .setCustomId(`jf-eb-${item.ServerId!}-${item.Id!}`)
    .setStyle(ButtonStyle.Success)
    .setLabel("Watch Trailer")
    .setEmoji("🎬");
}

