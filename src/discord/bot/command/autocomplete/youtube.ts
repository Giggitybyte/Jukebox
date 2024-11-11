import ytdl from "@distube/ytdl-core";
import { AutocompleteInteraction, CacheType } from "discord.js";

type Choice = { name: string, value: string };

export async function video(interaction: AutocompleteInteraction<CacheType>): Promise<void> {
    let query = interaction.options.getFocused().trim();

    if (ytdl.validateURL(query)) {
        let videoInfo = await ytdl.getInfo(query);

        let choice: Choice = {
            name: `'${videoInfo.videoDetails.title}' by ${videoInfo.videoDetails.author.name}`,
            value: videoInfo.videoDetails.video_url
        };

        await interaction.respond([choice]);
    } else {
        // Search for video
        // https://developers.google.com/youtube/v3/docs/search

        let choices: Choice[] = [];        
    }
}