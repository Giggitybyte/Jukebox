import * as youtubeAutoComplete from "./autocomplete/youtube";
import { SlashCommandBuilder, CacheType, ChatInputCommandInteraction, ChannelType, AutocompleteInteraction } from "discord.js";
import { command } from "@dank074/discord-video-stream";
import ytdl from '@distube/ytdl-core';
import { discordUser } from "../../user/discordUser";

export const data = new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Stream audio or video from Youtube')
    .addSubcommand(subcommand => subcommand
        .setName("video")
        .setDescription("Stream a YouTube video or short.")
        .addStringOption(option => option
            .setName("query")
            .setDescription("URL of a YouTube video, or enter any text to search for a video.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    );

export function autoComplete(interaction: AutocompleteInteraction<CacheType>): Promise<void> {
    if (interaction.options.getSubcommand() === "video") return youtubeAutoComplete.video(interaction);

    throw new Error(`Unknown command: ${interaction.options.getSubcommand()}`)
}

export function execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {
    if (interaction.options.getSubcommand() === "video") return videoSubcommand(interaction);

    throw new Error(`Unknown command: ${interaction.options.getSubcommand()}`)
}

async function videoSubcommand(interaction: ChatInputCommandInteraction<CacheType>): Promise<void> {

    let userVoiceState = await interaction.guild?.voiceStates.fetch(interaction.user.id);

    if (userVoiceState == undefined || userVoiceState.channelId == null) {
        await interaction.reply({ content: "⚠️ Please join a voice channel before streaming.", ephemeral: true });
        return;
    }

    await interaction.deferReply();

    let query = interaction.options.getString('query')!;
    let videoInfo = await ytdl.getInfo(query);

    
}

async function oldExecute(interaction: ChatInputCommandInteraction<CacheType>) {




    await new Promise<void>((resolve) => { // TODO: media queue
        command?.kill('SIGINT');
        setTimeout(() => resolve(), 500);
    });

    let videoInfo = await ytdl.getInfo(url);
    let formats = ytdl.filterFormats(videoInfo.formats, 'audioandvideo');
    let hdFormats = formats.filter(format => format.quality == 'hd720');

    let videoUrl: string;
    if (hdFormats.length > 0)
        videoUrl = hdFormats[0].url;
    else if (formats.length > 0)
        videoUrl = formats[0].url;
    else {
        let errorMsg = `Could not get stream for YouTube video ${videoInfo.videoDetails.videoId}`;
        console.warn(errorMsg);
        await interaction.editReply("⚠️ " + errorMsg);

        return;
    }

    let videoTitle = (videoInfo.videoDetails.title.length > 100)
        ? `${videoInfo.videoDetails.title.substring(0, 100)}...`
        : videoInfo.videoDetails.title;

    discordUser.setStatus('📺', `Streaming YouTube: ${videoTitle}`);
    await interaction.editReply(`✅ Streaming YouTube video **${videoTitle}**`); // TODO: playlists

    discordUser.streamVideo(videoUrl, interaction.guildId!, userVoiceState.channelId)
        .catch(e => {
            console.warn(`Something went wrong while streaming ${videoInfo.videoDetails.videoId} from YouTube in ${interaction.guildId!}\n${e}`);
            interaction.followUp(`Something went wrong while streaming *${videoTitle}*`);
        });
}