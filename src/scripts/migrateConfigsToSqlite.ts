import path from "node:path";
import { FileConfigRepository } from "../core/config/FileConfigRepository.js";
import { SqliteConfigRepository } from "../core/config/SqliteConfigRepository.js";

async function main(): Promise<void> {

    const fileRepo = new FileConfigRepository(process.env["CONFIGS_DIR"]);
    const dbPath = process.env["DATABASE_PATH"] ?? path.resolve(process.cwd(), "data", "configs.sqlite");
    const sqliteRepo = new SqliteConfigRepository(dbPath);

    const summaries = await fileRepo.list();
    console.log(`Found ${summaries.length} configuration(s) to migrate into ${dbPath}`);

    for (const summary of summaries) {
        const config = await fileRepo.load(summary.id);
        await sqliteRepo.save(config);
        console.log(`  migrated '${summary.id}'`);
    }

    await sqliteRepo.close();
    console.log("Done. Set CONFIG_STORAGE=sqlite (and DATABASE_PATH if you used a custom one) to start using it.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
