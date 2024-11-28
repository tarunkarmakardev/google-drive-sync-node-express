# Google Drive Sync using Node and express

## Steps

- Provide configuration using app-config.json at root level
- The scope in app-config.json as in sample below shouldn't be changed

## Sample `app-config.json`

```json
{
  "general": {
    "port": 7890
  },
  "synFolder": {
    "name": "XXX",
    "path": "XXX",
    "driveFolderId": "XXX",
    "driveFileId": "XXX"
  },
  "googleAuth": {
    "scopes": [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ],
    "credentials": {
      "client_id": "xxx",
      "project_id": "xxx",
      "client_secret": "xxxx",
      "redirect_uris": ["http://localhost:$PORT/auth/google/callback"]
    },
    "tokens": {
      "access_token": "xxx",
      "scope": "openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
      "token_type": "Bearer",
      "id_token": "xxxx",
      "expiry_date": 0
    }
  }
}
```
