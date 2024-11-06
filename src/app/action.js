"use server"

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { InfluxDB, Point } = require('@influxdata/influxdb-client')
const { getMIMEType } = require('node-mime-types');
const { exec } = require('child_process');
const os = require('os');

let client;
if (process.env.ENABLE_METRICS) {
    if (process.env.INFLUX_URL && process.env.INFLUX_TOKEN && process.env.INFLUX_ORG && process.env.INFLUX_BUCKET) {
        client = new InfluxDB({ url: process.env.INFLUX_URL, token: process.env.INFLUX_TOKEN });

        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }
        calculateMetrics(path.join(process.cwd(), 'data'));

    } else {
        const missingEnvVars = [];
        if (!process.env.INFLUX_URL) missingEnvVars.push('INFLUX_URL');
        if (!process.env.INFLUX_TOKEN) missingEnvVars.push('INFLUX_TOKEN');
        if (!process.env.INFLUX_ORG) missingEnvVars.push('INFLUX_ORG');
        if (!process.env.INFLUX_BUCKET) missingEnvVars.push('INFLUX_BUCKET');
        console.warn(`Missing environment variables: ${missingEnvVars.join(', ')}. Metrics will not be enabled.`);
    }
}

export async function updateMetric(key, value, increase = true) {
    if (!client) {
        console.warn('Metrics are not enabled.');
        return;
    }
    try {
        const writeApi = client.getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET);
        let finalValue = value;

        if (increase) {
            const queryApi = client.getQueryApi(process.env.INFLUX_ORG);
            const query = `from(bucket: "${process.env.INFLUX_BUCKET}")
                   |> range(start: -inf)
                   |> filter(fn: (r) => r._measurement == "${key}")
                   |> last()`;
            const result = await queryApi.collectRows(query);
            if (result.length > 0) {
                finalValue += result[0]._value;
            }
        }

        const point = new Point(key).intField('value', finalValue);
        writeApi.writePoint(point);
        await writeApi.close();
    } catch (error) {
        console.error('Error updating metric:', error);
    }
}

function generateRandomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


function getDiskUsage() {
    const directory = process.env.NODE_ENV == 'development' ? "/" : "/host";

    return new Promise((resolve, reject) => {
        if (os.platform() === 'win32') {
            exec(`wmic logicaldisk get size,freespace,caption`, (error, stdout) => {
                if (error) {
                    return reject(error);
                }
                const lines = stdout.trim().split('\n');
                const diskInfo = lines.find(line => line.includes(directory[0].toUpperCase() + ':'));
                if (diskInfo) {
                    const [_, free, total] = diskInfo.trim().split(/\s+/).map(Number);
                    resolve({ total, free });
                } else {
                    reject(new Error('Disk information not found.'));
                }
            });
        } else {
            exec(`df -k "${directory}"`, (error, stdout) => {
                if (error) {
                    return reject(error);
                }

                const lines = stdout.trim().split('\n');
                const [total, used, free] = lines[1].split(/\s+/).slice(1, 4).map(Number);
                resolve({ total: total * 1024, free: free * 1024 });
            });
        }
    });
}

async function calculateMetrics(dataDir) {
    let totalFiles = 0;
    let totalSize = 0;
    const fileTypeSize = {};

    fs.readdirSync(dataDir).forEach(folder => {
        const folderPath = path.join(dataDir, folder);
        if (fs.lstatSync(folderPath).isDirectory()) {
            const filesInFolder = fs.readdirSync(folderPath);
            totalFiles += filesInFolder.length;
            filesInFolder.forEach(file => {
                const filePath = path.join(folderPath, file);
                totalSize += fs.statSync(filePath).size;

                const mime = getMIMEType(filePath);
                if (!fileTypeSize[mime]) {
                    fileTypeSize[mime] = 0;
                }
                fileTypeSize[mime] += fs.statSync(filePath).size;
            });
        }
    });

    await updateMetric('files_on_disk', totalFiles, false);
    await updateMetric('size_on_disk', totalSize, false);

    if (client) {
        // Reset only the file type metrics that are not in fileTypeSize to 0
        const queryApi = client.getQueryApi(process.env.INFLUX_ORG);
        const query = `from(bucket: "${process.env.INFLUX_BUCKET}")
                       |> range(start: -inf)
                       |> filter(fn: (r) => r._measurement =~ /^file_type_/)`;
        const result = await queryApi.collectRows(query);
        const existingMetrics = new Set(result.map(row => row._measurement));
        for (const metric of existingMetrics) {
            if (!fileTypeSize[metric.replace('file_type_', '')]) {
                await updateMetric(metric, 0, false);
            }
        }
    }

    for (const [mime, size] of Object.entries(fileTypeSize)) {
        await updateMetric(`file_type_${mime}`, size, false);
    }

    const { total, free } = await getDiskUsage();
    const totalStorage = total;
    const usedStorage = total - free;
    await updateMetric('total_storage', totalStorage, false);
    await updateMetric('used_storage', usedStorage, false);
}

export async function purgeOldFolders() {
    const dataDir = path.join(process.cwd(), 'data');
    const now = new Date();
    let filesRemoved = false;

    if (fs.existsSync(dataDir)) {
        const folders = fs.readdirSync(dataDir);

        folders.forEach(async folder => {
            const folderPath = path.join(dataDir, folder);
            const metaFilePath = path.join(dataDir, `${folder}.meta`);

            if (fs.existsSync(metaFilePath)) {
                const expirationTime = parseInt(fs.readFileSync(metaFilePath, 'utf8'), 10);
                const expirationDate = new Date(expirationTime);

                if (now > expirationDate) {
                    fs.rmSync(folderPath, { recursive: true });
                    fs.unlinkSync(metaFilePath);
                    filesRemoved = true
                }
            }
        });

        if (filesRemoved) await calculateMetrics(dataDir);
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
            archive.on('end', async () => {
                const fileCount = fs.readdirSync(folderPath).length;
                await updateMetric('files_downloaded', fileCount);
                const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                await updateMetric('traffic_out', totalSize);

                resolve(Buffer.concat(chunks));
            });
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


    // Metrics
    let size = 0;
    for (const file of files) {
        const fileData = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        size += fileData.length;
    }

    await updateMetric('files_uploaded', files.length, false);
    await updateMetric('traffic_in', size, false);
    await calculateMetrics(dataDir);


    return code;
}