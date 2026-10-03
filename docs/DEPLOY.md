# Deploying terminal.kuartalsystems.com

The whole app is **one Node process** (API + built web app) in **one Docker container**.
Recommended home: your Ubuntu/Proxmox home server behind a **Cloudflare Tunnel**
(no open ports, free TLS, hides your home IP). Cost: Rp0.

## 1. On the server (once)

```sh
# Docker (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in after this

git clone https://github.com/kuartal-id/terminal.git
cd terminal
cp .env.example .env
nano .env
```

In `.env` set at least:
- `APP_URL=https://terminal.kuartalsystems.com`
- `SESSION_SECRET=` → paste the output of `openssl rand -base64 48`
- leave `KUARTAL_ID_CLIENT_ID/SECRET` empty for now (guest mode) — step 3 fills them.

## 2. Cloudflare Tunnel (DNS for kuartalsystems.com must be on Cloudflare)

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** → *Cloudflared* → name it `kuartal-terminal`.
2. Copy the token from the install command; put it in `.env` as `CLOUDFLARE_TUNNEL_TOKEN=…`.
3. **Public hostname**: subdomain `terminal`, domain `kuartalsystems.com`, service **HTTP** → `terminal:8787`.
4. Start everything:

```sh
docker compose --profile tunnel up -d --build
docker compose logs -f terminal     # look for "Kuartal Terminal API v0.1.0 on :8787"
```

Open https://terminal.kuartalsystems.com. Check every panel's badge: it should say
LIVE / DELAYED / EOD / ANNUAL — **DEMO means that source couldn't be reached** from the server.

Health check: `curl https://terminal.kuartalsystems.com/api/health`

### Already running Cloudflare Tunnel for Nextcloud?
Skip the `tunnel` profile (`docker compose up -d --build`) and add a public hostname
`terminal.kuartalsystems.com → http://localhost:8787` to your existing tunnel.

## 3. Turn on "Log in with Kuartal ID"

On the **Kuartal ID** server (id.kuartal.id, repo `kuartal-login`):

```sh
php artisan passport:client --name="Kuartal Terminal" \
  --redirect_uri=https://terminal.kuartalsystems.com/auth/callback
```

Choose a **confidential** client (with secret). Copy the client ID and secret into the
terminal's `.env`:

```
KUARTAL_ID_CLIENT_ID=...
KUARTAL_ID_CLIENT_SECRET=...
```

Then `docker compose up -d` again. Notes:
- Kuartal ID's logout only redirects back to hosts that are registered client redirect URIs, which this does.
- Pro panels unlock for users holding the `research.premium` entitlement (granted by the **Pro**,
  **Residence** and **Kuartal Team** memberships in Kuartal ID's `CatalogSeeder`). Change with `PREMIUM_ENTITLEMENT`.
- Optional: add `['key' => 'terminal-web', 'name' => 'Kuartal Terminal', 'domain' => 'terminal.kuartalsystems.com']`
  to the `$applications` list in kuartal-login's `CatalogSeeder` and link the client — follow that repo's AGENTS.md.

## 4. Updating

```sh
cd terminal
git pull
docker compose --profile tunnel up -d --build
```

Roll back to the known-good MVP any time: `git fetch origin && git checkout origin/stable/2026-10-03-mvp && docker compose up -d --build` (return with `git checkout main`).

## Alternatives
- **Any VPS** (e.g. Hostinger VPS): same Docker steps; point DNS at the VPS and use Caddy/Nginx for TLS, or still use the tunnel.
- **Hostinger shared hosting** won't work — it can't run a long-lived Node process.

## Resource use
~60–120 MB RAM, negligible CPU. Fine alongside Nextcloud on the i7-7700 box.
