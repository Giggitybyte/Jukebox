import { Message } from "discord.js-selfbot-v13";
import { Discord } from "../discord";

const commandList = ""
    + "//jellyfin :: Accepts a Jellyfin web link or a search term"
    + "//youtube :: Accepts a YouTube link for a video or a short"
    + "//volume :: Changes the volume of the stream. Default: 100"
    + "//disconnect :: Stops the stream and disconnects from the channel";

export async function helpCommand(discord: Discord, msg: Message, args: string[]) {
    await msg.reply("```asciidoc" + '\n' + commandList + '\n' + "```");
}