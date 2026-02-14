# BotMaker (Custom Deployment)

Web UI for managing OpenClaw AI chatbots. This version is configured to work with a custom OpenClaw build and LiteLLM.

## Prerequisites

- **Docker Desktop**
  - **Important**: Ensure your project directory (e.g., `/Users/{username}/Documents`) is added to **File Sharing** in Docker Desktop settings.
- **Node.js 20+**

## Setup Instructions

### 1. Create Docker Network
Create the internal network for bot containers:
```bash
docker network create bm-internal
```

### 2. Build Custom OpenClaw Image
We use a specific branch (`ui-update`) of OpenClaw. Build the image locally:

```bash
# Clone the specific branch
git clone -b ui-update https://github.com/Prmsnls/openclaw.git temp_openclaw

# Build the image
cd temp_openclaw
docker build -t openclaw:ui-update .

# Cleanup
cd ..
rm -rf temp_openclaw
```

### 3. Configuration (.env)
Create a `.env` file in the root directory:

```env
PORT=7100
ADMIN_PASSWORD={randomstring}
OPENCLAW_IMAGE=openclaw:ui-update
DATA_DIR=./data
SECRETS_DIR=./secrets
LITELLM_BASE_URL=https://llm.openputer.com
LLM_MASTER_KEY={openputer-llm-master-key}
```

### 4. Build BotMaker
Install dependencies and build the server and dashboard:

```bash
npm install
npm run build:all
```

## Running the Application

Start the server:
```bash
npm start
```

- **Dashboard**: [http://localhost:7100](http://localhost:7100)
- **Login Password**: `admin_password_123_secure` (or as configured in `.env`)

## Troubleshooting

### "Operation not permitted" (Docker Bind Mounts)
If you see errors about creating directories in `/host_mnt/...`, it means Docker doesn't have permission to mount your local folders.
1. Open **Docker Desktop Settings** > **Resources** > **File Sharing**.
2. Add your project's parent directory.
3. Restart Docker Desktop.

### "Failed to proxy to bot"
If the dashboard shows this error when opening a bot:
- Ensure the bot container is running (`docker ps`).
- The server expects to query `localhost` when running outside of Docker. If you are running `botmaker` inside Docker, it will use the container name. This is handled automatically by the `/.dockerenv` check, but ensure your `bm-internal` network exists.
