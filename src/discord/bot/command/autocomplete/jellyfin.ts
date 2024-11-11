import { AutocompleteInteraction, CacheType } from "discord.js";
import { jellyfinApi } from "../../../../jellyfin/jellyfinApi";
import { BaseItemDto, BaseItemKind, SearchHint } from "@jellyfin/sdk/lib/generated-client/models";
import { getSearchApi, getSuggestionsApi } from "@jellyfin/sdk/lib/utils/api";

type Choice = { name: string, value: string };

export async function search(interaction: AutocompleteInteraction<CacheType>): Promise<void> {
    let focusedOption = interaction.options.getFocused(true);
    let choices: Choice[] = [];

    if (focusedOption.name == "server") {
        for (let server of jellyfinApi.servers.values()) {
            choices.push({
                name: server.name,
                value: server.id
            });
        }
    } else if (focusedOption.name == "query") {
        let serverId = interaction.options.getString("server")!;
        let server = jellyfinApi.servers.get(serverId)!;
        let items: BaseItemDto[] | SearchHint[] = [];
        
        if (!focusedOption.value || !focusedOption.value.trim()) {
            let result = await getSuggestionsApi(server.api).getSuggestions({
                userId: server.token,
                type: [BaseItemKind.Movie, BaseItemKind.Series],
                limit: 25
            });

            items = result.data.Items!;
        } else {
            let result = await getSearchApi(server.api).get({
                searchTerm: focusedOption.value,
                limit: 25,
                includeItemTypes: [BaseItemKind.Series, BaseItemKind.Movie]
            });

            items = result.data.SearchHints!
        }

        let results = items!.sort((a: BaseItemDto | SearchHint, b: BaseItemDto | SearchHint) => {
            return b.Type!.localeCompare(a.Type!) || a.Name!.localeCompare(b.Name!);
        });

        for (let searchResult of results) {
            let emoji = searchResult.Type! == 'Movie' ? '🎥' : '📺';
            let title = searchResult!.Name!.length >= 50 ? `${searchResult!.Name!.substring(0, 50)}...` : searchResult!.Name!;
            let year = searchResult!.ProductionYear != null ? `(${searchResult!.ProductionYear})` : "";

            choices.push({
                name: `${emoji} ${title} ${year}`,
                value: searchResult!.Id!
            });
        }
    }

    await interaction.respond(choices);
}