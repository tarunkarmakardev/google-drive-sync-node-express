import { getIsAuthenticated, syncDrive, resetDriveFileLink } from "./lib";
import { startServer } from "./server";

export async function startDriveUploadFlow({ newFile }: { newFile: boolean }) {
  if (newFile) {
    await resetDriveFileLink();
  }
  const isAuthenticated = await getIsAuthenticated();
  if (isAuthenticated) {
    syncDrive();
  } else {
    console.log(`Not Authenticated`);
    startServer();
  }
}

export async function startAuthFlow() {
  startServer();
}
