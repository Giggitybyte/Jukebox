import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { ButtonInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";

export function seriesSeasons(seasons: BaseItemDto[], seriesId: string): StringSelectMenuBuilder {
	let selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`jf-ss-${seriesId}`)
		.setPlaceholder("Select a season from this series")
		.setMinValues(1)
		.setMaxValues(1);

	for (const season of seasons) {
		let option = new StringSelectMenuOptionBuilder()
			.setLabel(season.Name!)
			.setValue(season.Id!);

		if (season.ProductionYear) {
			option.setDescription(season.ProductionYear.toString());
		}

		selectMenu.addOptions(option);
	}

	return selectMenu;
}

export function seriesEpisode(episode: BaseItemDto) {
	return new StringSelectMenuBuilder().data.
		.setCustomId('select')
		.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel('Option')
				.setValue('option')
				.setDescription('A selectable option')
				.setEmoji('123456789012345678'),
		);
}

export function movie(movie: BaseItemDto): StringSelectMenuBuilder {
    throw new Error("Function not implemented.");
}
