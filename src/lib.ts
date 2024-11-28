import fs from "fs-extra";
import path from "path";
import folderSize from "fast-folder-size/sync";
import archiver from "archiver";
import { google } from "googleapis";
import cliProgress from "cli-progress";
import { AppConfig, EventHooks } from "./types";
import { logger } from "./logger";

const WORK_DIR = path.join(
  process.env.USERPROFILE as string,
  "./Documents/gds-app"
);

export function fromRootPath(filePath: string) {
  return path.join(WORK_DIR, filePath);
}
export async function readJSONfileData<T>(filePath: string) {
  await fs.ensureFile(fromRootPath(filePath));
  const file = await fs.readFile(fromRootPath(filePath));
  const data = JSON.parse(file.toString() || "{}");
  return data as T;
}

export async function writeJSONfileData<T>(
  filePath: string,
  cb: (data: T) => T
) {
  const data = await readJSONfileData<T>(filePath);
  const updatedData = cb(data);
  await fs.outputFile(
    fromRootPath(filePath),
    JSON.stringify(updatedData, null, 2)
  );
  return updatedData;
}

export function getAppConfig() {
  return readJSONfileData<AppConfig>("./app-config.json");
}

export async function getPort() {
  const appConfig = await getAppConfig();
  return appConfig.general.port;
}

export async function getIsAuthenticated() {
  const appConfig = await getAppConfig();
  return Boolean(appConfig.googleAuth.tokens);
}

export async function createGoogleOAuthClient() {
  const PORT = await getPort();
  const appConfig = await getAppConfig();

  const REDIRECT_URI =
    appConfig.googleAuth.credentials.redirect_uris[0].replace(
      "$PORT",
      PORT.toString()
    );
  const tokens = appConfig.googleAuth.tokens;
  const oauthClient = new google.auth.OAuth2({
    clientId: appConfig.googleAuth.credentials.client_id,
    clientSecret: appConfig.googleAuth.credentials.client_secret,
    redirectUri: REDIRECT_URI,
  });
  if (tokens) {
    oauthClient.setCredentials(tokens);
  }
  oauthClient.on("tokens", (tokens) => {
    handleTokenUpdate(tokens);
  });
  const authUrl = oauthClient.generateAuthUrl({
    scope: appConfig.googleAuth.scopes,
    redirect_uri: REDIRECT_URI,
    access_type: "offline",
    prompt: "consent",
  });
  return { client: oauthClient, authUrl, tokens };
}

export async function getFolderDetails() {
  const appConfig = await getAppConfig();
  const folderPath = appConfig.synFolder.path;
  const copiedDataPath = path.join(WORK_DIR, "copied-data");
  const { driveFileId, driveFolderId } = appConfig.synFolder;
  const zipName = `${path.parse(folderPath).name}.zip`;
  const zipPath = path.join(WORK_DIR, zipName);
  return {
    folderPath,
    zipPath,
    zipName,
    driveFolderId,
    driveFileId,
    copiedDataPath,
  };
}

export async function deleteNestedFolders(dir: string) {
  if (await fs.exists(dir)) {
    for (const entry of await fs.readdir(dir)) {
      const filePath = path.join(dir, entry);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        if (entry === "node_modules") {
          // Recursively delete the 'node_modules' folder
          await deleteNestedFolders(filePath);
          await fs.rm(filePath, { recursive: true });
        } else {
          // Recursively delete 'node_modules' folders within subdirectories
          await deleteNestedFolders(filePath);
        }
      }
    }
  }
}

export function createCliProgressBar(title: string) {
  const format = `${title}: [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}`;
  return new cliProgress.SingleBar(
    {
      format,
    },
    cliProgress.Presets.shades_classic
  );
}

export async function copyDataToTemp() {
  const { folderPath, copiedDataPath } = await getFolderDetails();
  logger.info("Copying data...\n");
  await fs.rm(copiedDataPath, { recursive: true });
  await fs.copy(folderPath, copiedDataPath);
}

export async function deleteNodeModules() {
  const { copiedDataPath } = await getFolderDetails();
  logger.info("Deleting node_modules...\n");
  await deleteNestedFolders(copiedDataPath);
}

export async function zipFolder({ onDone, onProgress, onStart }: EventHooks) {
  const { zipPath, copiedDataPath } = await getFolderDetails();
  const totalSize = folderSize(copiedDataPath);
  if (!totalSize) return;
  const output = fs.createWriteStream(zipPath);
  const zip = archiver("zip", { zlib: { level: 0 } });
  zip.pipe(output);
  zip.directory(copiedDataPath, false);
  onStart();
  zip.on("progress", (progress) => {
    const progressValue = (progress.fs.processedBytes / totalSize) * 100;
    onProgress(Math.min(Number(progressValue.toFixed(2)), 100));
  });
  await zip.finalize();
  onDone();
}

export async function uploadToDrive({
  onStart,
  onProgress,
  onDone,
}: {
  onStart: () => void;
  onProgress: (value: number) => void;
  onDone: () => void;
}) {
  const { client } = await createGoogleOAuthClient();
  let result;
  const { driveFolderId, zipPath, zipName, driveFileId } =
    await getFolderDetails();
  const drive = google.drive({
    version: "v3",
    auth: client,
  });

  const totalSize = fs.statSync(zipPath).size;
  if (!totalSize) return;
  onStart();

  const uploadOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUploadProgress: (uploadEvent: any) => {
      const progress = (uploadEvent.bytesRead / totalSize) * 100;
      const progressValue = progress === Infinity ? 100 : progress;
      onProgress(Math.min(Number(progressValue.toFixed(2)), 100));
    },
  };
  if (driveFileId) {
    result = await drive.files.update(
      {
        fileId: driveFileId,
        requestBody: {
          name: zipName,
        },
        media: {
          body: fs.createReadStream(zipPath),
        },
      },
      uploadOptions
    );
  } else {
    result = await drive.files.create(
      {
        requestBody: {
          name: zipName,
          parents: [driveFolderId],
        },
        media: {
          body: fs.createReadStream(zipPath),
        },
      },
      uploadOptions
    );
  }
  if (result.status === 200 && result.data.id) {
    await writeJSONfileData<AppConfig>("./app-config.json", (data) => {
      if (result.data.id) {
        data.synFolder.driveFileId = result.data.id;
      }
      return data;
    });
    logger.success(
      `\n Open file: https://drive.google.com/drive/folders/${driveFolderId}`
    );
    onDone();
  }
}

export async function resetDriveFileLink() {
  await writeJSONfileData<AppConfig>("./app-config.json", (data) => {
    data.synFolder.driveFileId = null;
    return data;
  });
}

export async function syncDrive() {
  await copyDataToTemp();
  await deleteNodeModules();
  const zipProgressBar = createCliProgressBar("Zipping");
  await zipFolder({
    onStart: () => {
      logger.info("Zipping data...");
      zipProgressBar.start(100, 0);
    },
    onProgress: (value) => {
      zipProgressBar.update(value);
    },
    onDone: () => {
      zipProgressBar.stop();
      logger.success("Zipping complete...\n");
    },
  });
  const uploadProgressBar = createCliProgressBar("Uploading");
  await uploadToDrive({
    onStart: () => {
      logger.info("Uploading data...");
      uploadProgressBar.start(100, 0);
    },
    onProgress: (value) => {
      uploadProgressBar.update(value);
    },
    onDone: () => {
      uploadProgressBar.stop();
      logger.success("Upload complete...\n");
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleTokenUpdate(tokens: any) {
  return await writeJSONfileData<AppConfig>("./app-config.json", (data) => {
    data.googleAuth.tokens = { ...data.googleAuth.tokens, ...tokens };
    return data;
  });
}
