export type AppConfig = {
  general: {
    port: number;
  };
  synFolder: {
    path: string;
    name: string;
    driveFolderId: string;
    driveFileId: string | null;
  };
  googleAuth: {
    scopes: string[];
    credentials: {
      client_id: string;
      project_id: string;
      client_secret: string;
      redirect_uris: string[];
    };
    tokens: {
      access_token: string;
      scope: string;
      token_type: string;
      id_token: string;
      expiry_date: number;
    } | null;
  };
};
export type EventHooks = {
  onStart: () => void;
  onProgress: (value: number) => void;
  onDone: () => void;
};
