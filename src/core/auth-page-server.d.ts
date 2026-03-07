export namespace PROVIDERS {
    let oauth: {
        id: string;
        name: string;
        icon: string;
        color: string;
    }[];
    let apikey: {
        id: string;
        name: string;
        icon: string;
        color: string;
        prefix: string;
    }[];
}
export const server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
import http = require("http");
//# sourceMappingURL=auth-page-server.d.ts.map