import { Discord } from "./discord.js";
import dotenv from "dotenv";

dotenv.config();

const discord = new Discord();
discord.gatewayClient.login(process.env.DISCORD_TOKEN);