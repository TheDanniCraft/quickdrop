"use server"

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function generateRandomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export async function purgeOldFolders() {
    const dataDir = path.join(process.cwd(), 'data');
    const now = new Date();

    if (fs.existsSync(dataDir)) {
        const folders = fs.readdirSync(dataDir);

        folders.forEach(folder => {
            const folderPath = path.join(dataDir, folder);
            const metaFilePath = path.join(dataDir, `${folder}.meta`);

            if (fs.existsSync(metaFilePath)) {
                const expirationTime = parseInt(fs.readFileSync(metaFilePath, 'utf8'), 10);
                const expirationDate = new Date(expirationTime);

                if (now > expirationDate) {
                    fs.rmSync(folderPath, { recursive: true });
                    fs.unlinkSync(metaFilePath);
                }
            }
        });
    }
}

export async function getFiles(code) {
    const dataDir = path.join(process.cwd(), 'data');
    const folderPath = path.join(dataDir, code);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    if (fs.existsSync(folderPath)) {
        const archive = archiver('zip', {
            zlib: { level: 1 }
        });

        return new Promise((resolve, reject) => {
            const chunks = [];
            archive.on('data', chunk => chunks.push(chunk));
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', err => reject(err));

            archive.directory(folderPath, false);
            archive.finalize();
        });
    } else {
        return null;
    }
}

export async function saveFiles(files, expiresInHours = 2) {
    let code;
    let folderPath;
    const dataDir = path.join(process.cwd(), 'data');
    do {
        code = generateRandomCode();
        folderPath = path.join(dataDir, code);
    } while (fs.existsSync(folderPath));

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + expiresInHours);
    const metaFilePath = path.join(dataDir, `${code}.meta`);
    fs.writeFileSync(metaFilePath, expirationDate.getTime().toString());
    for (const file of files) {
        const filePath = path.join(folderPath, file.name);
        const fileData = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        fs.writeFileSync(filePath, fileData);
    }

    return code;
}