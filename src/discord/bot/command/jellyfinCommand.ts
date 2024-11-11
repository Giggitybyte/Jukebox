import * as jellyfinAutoComplete from "./autocomplete/jellyfin";
import * as jellyfinEmbed from "../embed/jellyfin";
import * as jellyfinSelect from "../select/jellyfin";
import * as jellyfinButton from "../button/jellyfin";
import { JellyfinServer, jellyfinApi } from "../../../jellyfin/jellyfinApi";

import { BaseItemDto, BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api";
import { SlashCommandBuilder, CacheType, ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import ytdl from "@distube/ytdl-core";
import { randomInt } from "crypto";

export const data = new SlashCommandBuilder()
    .setName('jellyfin')
    .setDescription('Stream movies and series from Jellyfin.')
    .addSubcommand(subcommand => subcommand
        .setName("search")
        .setDescription("Search for available media from Jellyfin.")
        .addStringOption(option =>
            option.setName("server")
                .setDescription("Name of the Jellyfin server to query.")
                .setRequired(true)
                .setMinLength(1)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName("query")
                .setDescription("Title of a movie, series or anime.")
                .setRequired(true)
                .setMinLength(1)
                .setAutocomplete(true)
        )
    );

export function autoComplete(interaction: AutocompleteInteraction<CacheType>): Promise<void> {
    if (interaction.options.getSubcommand() === "search") return jellyfinAutoComplete.search(interaction);

    throw new Error(`Unknown command: ${interaction.options.getSubcommand()}`);
}

export function execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    if (interaction.options.getSubcommand() === "search") return searchSubcommand(interaction);

    throw new Error(`Unknown command: ${interaction.options.getSubcommand()}`);
}

async function searchSubcommand(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    let serverId: string = interaction.options.getString('server')!;
    let server: JellyfinServer = jellyfinApi.servers.get(serverId)!;

    let itemId: string = interaction.options.getString('query')!;
    let item: BaseItemDto = await jellyfinApi.getItem(serverId, itemId);

    let embed: EmbedBuilder;
    let selectMenuRow = new ActionRowBuilder<StringSelectMenuBuilder>();
    let buttonRow = new ActionRowBuilder<ButtonBuilder>();

    if (item.RemoteTrailers) {
        let youtubeTrailers = item.RemoteTrailers
            .filter(trailer => trailer.Url != null)
            .filter(trailer => ytdl.validateURL(trailer.Url!))
            .slice(0, 3);

        if (youtubeTrailers.length != 0) {
            for (const trailer of youtubeTrailers) {
                buttonRow.addComponents(jellyfinButton.trailer(trailer.Url!));
            }
        }
    }

    if (item.Type! == BaseItemKind.Series) {
        let seasonsResponse = await getTvShowsApi(server.api).getSeasons({ seriesId: item.Id! });
        let seasonCount = seasonsResponse.data.TotalRecordCount!;
        let seasons = seasonsResponse.data.Items!;

        embed = jellyfinEmbed.series(item, seasonCount);
        selectMenuRow.addComponents(jellyfinSelect.seriesSeasons(seasons, item.Id!));
    } else if (item.Type! == BaseItemKind.Movie) {
        embed = jellyfinEmbed.movie(item);
        selectMenuRow.addComponents(jellyfinSelect.movie(item));
    } else {
        throw new Error(`Unexpected item type: ${item.Type}`);
    }

    await interaction.reply({ embeds: [embed], components: [selectMenuRow] });
}