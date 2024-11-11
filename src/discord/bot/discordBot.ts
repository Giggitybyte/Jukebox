import path from "node:path";
import fs from "node:fs"
import { discordBotToken, discordBotAppId, guildId } from "../../../config/discord.json";
import { ActivityType, APIStringSelectComponent, AutocompleteInteraction, BaseSelectMenuBuilder, ButtonBuilder, ButtonInteraction, CacheType, ChatInputCommandInteraction, Client, Collection, Events, GatewayIntentBits, Routes, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';

export class DiscordBot {
    private discordWebsocket: Client;
    private commands: Collection<string, Command>;
    private buttons: Collection<string, Button>;
    private selectMenus: Collection<string, SelectMenu>

    public get gatewayClient() {
        return this.discordWebsocket;
    }

    public get restClient() {
        return this.discordWebsocket.rest;
    }

    constructor() {
        this.discordWebsocket = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this.commands = new Collection<string, Command>;
        let commandsPath = path.join(__dirname, 'command');
        let commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

        for (let file of commandFiles) {
            let filePath = path.join(commandsPath, file);
            let command: Command = require(filePath);

            this.commands.set(command.data.name, command);
        }

        this.discordWebsocket.on(Events.InteractionCreate, async interaction => {
            if ((interaction.isChatInputCommand() || interaction.isAutocomplete())) {
                let command: Command | undefined = this.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`Received unknown command: "${interaction.commandName}"`);
                    return;
                }

                if (interaction.isChatInputCommand()) {
                    try {
                        await command.execute(interaction);
                    } catch (error) {
                        console.error(error);

                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });
                        } else {
                            await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
                        }
                    }
                } else if (interaction.isAutocomplete()) {
                    try {
                        await command.autoComplete(interaction);
                    } catch (error) {
                        console.error(error);
                    }
                }

            }
        });

        this.discordWebsocket.once(Events.ClientReady, client => {
            console.log(`Logged in as ${client.user.tag}`);
        });
    }

    public async registerCommands() {
        let commands: any[] = [];

        for (const command of this.commands.values()) {
            commands.push(command.data)
        }

        try {
            console.log(`Registering ${commands.length} slash commands.`);

            let data: any = await this.restClient.put(
                Routes.applicationGuildCommands(discordBotAppId, guildId),
                { body: commands },
            );

            console.log(`Successfully registered ${data.length} slash commands.`);
        } catch (error) {
            console.error(error);
        }
    }

    public connect(): Promise<string> {
        return this.discordWebsocket.login(discordBotToken);
    }

    public async disconnect() {
        this.discordWebsocket.destroy()
    }

    public setStatus(emoji: string, message: string) {
        this.discordWebsocket.user!.setPresence({
            activities: [
                {
                    type: ActivityType.Custom,
                    name: "",
                    state: `${emoji} ${message}`
                }
            ]
        });
    }
}

type Command = {
    data: any;
    autoComplete(interaction: AutocompleteInteraction<CacheType>): Promise<void>;
    execute(interaction: ChatInputCommandInteraction<CacheType>): Promise<void>;
}

export const discordBot = new DiscordBot();