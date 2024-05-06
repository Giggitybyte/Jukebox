import { jellyfinSdk } from "./jellyfin";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Message } from "discord.js-selfbot-v13";

export async function movieOverview(msg: Message, movie: BaseItemDto): Promise<Message> {
    let server = jellyfinSdk.servers.get(movie.ServerId!)!;
    let duration = jellyfinSdk.convertTicks(movie.RunTimeTicks!);
    let overview = "```asciidoc\n";
    let header = `${movie.Name!} (Movie)`;

    overview += header + '\n' + '='.repeat(header.length) + '\n\n';
    overview += (movie.Overview ?? "* No description available.") + "\n\n";
    overview += "Release Year :: " + (movie.ProductionYear ?? "Unknown") + '\n';
    overview += `Duration :: ${duration.hours} hours ${duration.minutes} minutes\n`;
    overview += `Resolution :: ${movie.Width}x${movie.Height}\n`
    overview += "Source :: " + server.name + "\n\n";
    overview += "[Add any reaction to this message to begin streaming]\n```"

    return await msg.channel.send(overview);
}