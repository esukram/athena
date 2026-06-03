# **Athena 🦉**

A customizable, structure-first application for mastering new topics through index-card style learning.

## **📖 About The Project**

**Athena** is designed to give learners control over their training material. Unlike rigid learning platforms, Athena allows users to build their own curriculum from the ground up. Whether you are learning a new language, studying for certifications, or onboarding employees, Athena provides the framework to organize complex topics into manageable, bite-sized "index cards."

### **Core Philosophy**

1. **Structure First:** Knowledge is easier to retain when it is organized hierarchically.
2. **Active Recall:** Using an index-card/flashcard interface to test knowledge rather than just passively reading it.
3. **User-Driven Content:** The user is the architect of their own learning path.

## **🗂️ Content Structure**

Athena uses a strict three-tier hierarchy to keep learning materials organized:

1. **Course / Lecture:** The top-level container for a specific subject (e.g., "Advanced Biology" or "Introduction to Python").
2. **Chapter:** Logical subdivisions within a Course to group related concepts (e.g., "Cell Structures" or "List Comprehensions").
3. **Index Card:** The atomic unit of learning. A Question & Answer combination used for study and evaluation.

## **✨ Key Features**

- **Topic Management:** Create high-level subjects and drill down into specific sub-topics.
- **Index-Card Interface:**
  - Front/Back card design for questions and answers.
  - Support for rich text, code snippets, and images.
- **Voice Interaction & Evaluation:** The app reads questions aloud, allows users to respond via voice, and provides AI-driven evaluation on correctness and feedback.
  - Pluggable TTS backend selected via the `TTS_PROVIDER` env var — currently Azure Cognitive Services (SSML-driven) and Google Cloud TTS (Chirp3-HD with `[pause]` markup), with multi-voice support across English and German.
- **Training Mode:** Shuffle/randomized review with auto-advance, and progress-aware ordering that surfaces unreviewed questions first.
- **Progress Tracking:** Visual indicators of mastery for each topic.
- **Localization:** Full UI in English and German, with browser-language auto-detection.
- **Global Search:** Search chapters across all courses from anywhere in the app.
- **Chapter Organization:** Tag chapters with associations (categories) and move chapters between courses.

## **🛠️ Tech Stack**

- **Language:** TypeScript (Full Stack)
- **Frontend:** React.js
- **Design System:** Tailwind CSS
- **Backend:** Node.js
- **API:** tRPC and Fastify
- **Database:** SQLite
- **Testing:** vitest

See [ARCHITECTURE.md](ARCHITECTURE.md) for more information on the architecture of the application.

## **🚀 Getting Started**

### **Prerequisites**

- Node.js (v18 or higher)
- pnpm

### **Installation**

1. Clone the repository:

   ```
   git clone https://github.com/esukram/athena.git
   ```

2. Navigate to the project directory:  
   cd athena

3. Install dependencies:
   pnpm install

4. Start the development server:
   pnpm dev

## **🔒 Deployment Recommendation**

Athena ships **no application-level authentication** — every API route is public by
design, so the server is meant to run **behind a reverse proxy that owns the
security boundary**. The reference deployment is single-user and looks like this:

```
Internet ──HTTPS──▶ nginx ──HTTP (loopback/internal)──▶ Athena (:4000)
                     │
                     ├─ TLS termination (HTTPS only, HSTS, HTTP→HTTPS redirect)
                     ├─ HTTP Basic Auth  (single user, strong password)
                     └─ fail2ban         (bans IPs after repeated 401s)
```

**Recommended controls**

- **Reverse proxy + TLS:** terminate HTTPS at nginx and redirect all plain HTTP to
  HTTPS. Basic Auth credentials must never travel over an unencrypted connection.
- **HTTP Basic Auth at nginx:** gate the whole site. Use a strong, unique password
  and make sure the `auth_basic` block covers **every** path — the SPA, static
  assets, **and** the `/api/` routes — not just the app root.
- **fail2ban:** watch the proxy's auth log and ban IPs after repeated failed
  Basic Auth attempts to blunt brute-force / credential-stuffing.
- **⚠️ Do not expose the app port directly.** Athena binds `0.0.0.0:4000` inside the
  container. Publish it **only** to the proxy — bind to loopback
  (`-p 127.0.0.1:4000:4000`) or keep it on an internal Docker network with no host
  port mapping. If `:4000` is reachable from the internet, the proxy (and therefore
  all authentication) is bypassed entirely.

**Example nginx server block**

```nginx
server {
    listen 443 ssl;
    server_name athena.example.com;

    ssl_certificate     /etc/letsencrypt/live/athena.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/athena.example.com/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        auth_basic           "Athena";
        auth_basic_user_file /etc/nginx/.htpasswd;   # htpasswd -B -c ... athena

        proxy_pass         http://127.0.0.1:4000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        client_max_body_size 1m;                     # caps TTS fan-out / oversized rows
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name athena.example.com;
    return 301 https://$host$request_uri;
}
```

**If you use a cloud TTS provider** (Azure / Google), also set a **spend/quota cap or
budget alert** on the provider side and mount the service-account key **read-only**.
This bounds cost if a request ever triggers a large synthesis fan-out.

> A full security review of the codebase, including the rationale behind these
> recommendations, is available in [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

## **📄 License**

Distributed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE) for more information.
