import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface TestServer {
    url: string;
    close(): Promise<void>;
}

export type RouteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export async function startFixtureServer(
    fixtureDir: string,
    routes: Record<string, RouteHandler> = {}
): Promise<TestServer> {

    const server = createServer(async (req, res) => {

        const requestUrl = new URL(req.url ?? "/", "http://localhost");
        const pathname = requestUrl.pathname;

        const customHandler = routes[pathname];

        if (customHandler) {
            await customHandler(req, res);
            return;
        }

        try {
            const filePath = path.join(fixtureDir, pathname === "/" ? "/index.html" : pathname);
            const content = await readFile(filePath);
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(content);
        } catch {
            res.writeHead(404);
            res.end("Not found");
        }
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();

    if (!address || typeof address === "string") {
        throw new Error("Failed to determine test server address");
    }

    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        })
    };
}
