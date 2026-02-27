const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

const BASE_DIR = path.join(process.cwd(), 'workspace_files');

async function syncToDisk(groupId, fileName, content) {
    const groupDir = path.join(BASE_DIR, String(groupId));
    const filePath = path.join(groupDir, fileName);

    try {
        if (!fs.existsSync(groupDir)) {
            await mkdir(groupDir, { recursive: true });
        }

        let text = '';
        if (content.text !== undefined) {
            text = content.text;
        } else if (content.cells !== undefined) {
            text = JSON.stringify(content.cells, null, 2);
        } else if (content.binary) {
            // We don't sync binary for now or just skip
            return;
        }

        await writeFile(filePath, text);
        console.log(`Synced file to disk: ${filePath}`);
    } catch (error) {
        console.error('Error syncing file to disk:', error);
    }
}

module.exports = { syncToDisk, BASE_DIR };
