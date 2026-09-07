export class HttpClient {

    async get(url: string): Promise<string> {

        const response = await fetch(url, {
            headers: {
                "User-Agent": "ScraperSystem/1.0"
            }
        });

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}: Failed to fetch ${url}`
            );
        }

        return await response.text();
    }
}