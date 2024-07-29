import os from 'os'
import jsonfile from 'jsonfile';
import urlcat from 'urlcat';
import { Api, ClientInfo, DeviceInfo, Jellyfin } from "@jellyfin/sdk";
import { getItemsApi, getSystemApi, getImageApi } from "@jellyfin/sdk/lib/utils/api";
import { BaseItemDto, BaseItemKind, ImageType, ItemFields } from '@jellyfin/sdk/lib/generated-client/models';

export class JellyfinApi {
    private _jellyfin: Jellyfin;
    private _servers: Map<string, JellyfinServer>;

    public get servers(): ReadonlyMap<string, JellyfinServer> {
        return this._servers;
    }

    public get clientInfo(): ClientInfo {
        return this._jellyfin.clientInfo;
    }

    public get deviceInfo(): DeviceInfo {
        return this._jellyfin.deviceInfo;
    }

    constructor() {
        this._jellyfin = new Jellyfin({
            clientInfo: {
                name: 'Jukebox',
                version: 'alpha-0.1'
            },
            deviceInfo: {
                name: os.hostname(),
                id: `development` // TODO: create unique ID
            }
        });

        this._servers = new Map<string, JellyfinServer>();

        let jsonServers: JsonServer[] = jsonfile.readFileSync('./config/jellyfin.json')
        jsonServers.forEach(async server => await this.addServer(server.address, server.token));
    }

    public convertTicks(ticks: number) { // TODO: add seconds
        return {
            days: Math.floor(ticks / (24 * 60 * 60 * 10000000)),
            hours: Math.floor((ticks / (60 * 60 * 10000000)) % 24),
            minutes: Math.round((ticks / (60 * 10000000)) % 60)
        };
    }

    public async getItem(serverId: string, itemId: string): Promise<BaseItemDto | undefined> {
        let server = this.servers.get(serverId)!;
        let itemsApi = getItemsApi(server.api);
        let result = await itemsApi.getItems({
            ids: [itemId],
            fields: [
                ItemFields.Overview,
                ItemFields.ChildCount,
                ItemFields.RecursiveItemCount,
                ItemFields.Width,
                ItemFields.Height,
                ItemFields.OriginalTitle,
                ItemFields.Chapters
            ],
        });

        if (result.data.TotalRecordCount == 0) {
            return;
        }

        return result.data.Items![0];
    }

    public async getItems(serverId: string, types: BaseItemKind[]): Promise<BaseItemDto[]> {
        let server = this.servers.get(serverId)!;
        let itemsApi = getItemsApi(server.api);

        let result = await itemsApi.getItems({
            recursive: true,
            includeItemTypes: types,
            fields: [
                ItemFields.Overview,
                ItemFields.ChildCount,
                ItemFields.RecursiveItemCount,
                ItemFields.Width,
                ItemFields.Height,
                ItemFields.OriginalTitle,
                ItemFields.ProviderIds,
                ItemFields.MediaStreams
            ],
        });

        if (result.data.TotalRecordCount == 0) {
            return [];
        }

        return result.data.Items!;
    }

    public getItemImageUrl(serverId: string, itemId: string, imageType: ImageType = 'Primary'): string {
        let server = this.servers.get(serverId)!;
        return `${server.address}/Items/${itemId}/Images/${imageType}`;
    }

    public async getVideoStreamUrl(serverId: string, itemId: string) {
        let video = await this.getItem(serverId, itemId);
        if (video == undefined) return;

        if (video.Type != 'Episode' && video.Type != 'Movie') {
            throw new Error(`Expected an episode or movie, got ${video.Type}`);
        }

        let server = this.servers.get(serverId)!;
        return urlcat(server.address, "/Videos/:itemId/stream", this.videoParameters(itemId));
    }

    public async addServer(url: string, token: string) {
        let server = await this.validateServerAddress(url, token)
        this._servers.set(server.id, server);
        this.writeServerJson();
    }

    public async removeServer(id: string) {
        if (this._servers.delete(id)) this.writeServerJson();
    }

    private async validateServerAddress(url: string, token: string): Promise<JellyfinServer> {
        let server = new JellyfinServer();
        server.address = url;
        server.token = token;

        server.api = this._jellyfin.createApi(server.address, server.token);
        let systemApi = getSystemApi(server.api);

        try {
            await systemApi.getPingSystem();
        } catch (e) {
            throw new URIError(`Unable to connect to server '${server.address}' (${e.code})`)
        }

        let serverInfo = await systemApi.getPublicSystemInfo();
        server.id = serverInfo.data.Id as string;
        server.name = serverInfo.data.ServerName as string;

        return server;
    }

    private async writeServerJson() {
        let index: number = 0;
        let jsonServers: JsonServer[] = [];

        for (let server of this._servers.values()) {
            let { address, token, ...unused } = server;
            jsonServers[index++] = { address: address, token: token };
        }

        await jsonfile.writeFile('./config/jellyfin.json', jsonServers, { spaces: 2 })
    }

    private videoParameters(videoId: string) {
        return {
            itemId: videoId,
            container: "ts",
            videoCodec: 'h264',
            maxFramerate: 30,
            copyTimestamps: true
        };
    }
}

export class JellyfinServer implements JsonServer {
    id: string;
    name: string;
    address: string;
    token: string;
    api: Api;
}

interface JsonServer {
    address: string;
    token: string;
}

export const jellyfinApi = new JellyfinApi();