# OpsBash — Free DevOps Tools

A collection of free, browser-based DevOps tools for engineers and sysadmins. No login required, no data sent to any server.

**Live site:** [https://opsbash.com](https://opsbash.com)

## Tools

| Tool | Description |
| :--- | :---------- |
| **Cron Expression Generator** | Build and validate cron expressions with a visual UI and human-readable preview |
| **CIDR Calculator** | Calculate subnet ranges, broadcast addresses, and host counts for IPv4 and IPv6 |

## Tech Stack

- [Astro JS](https://astro.build) — static site framework
- [Tailwind CSS](https://tailwindcss.com) — utility-first styling
- [Cloudflare Pages](https://pages.cloudflare.com) — hosting and CDN

## Local Setup

```sh
git clone https://github.com/your-username/opsbash-cron.git
cd opsbash-cron
npm install
cp .env.example .env   # then fill in your values
npm run dev            # starts dev server at http://localhost:4321
```

## Environment Variables

| Variable | Description |
| :------- | :---------- |
| `PUBLIC_GA_ID` | Google Analytics 4 measurement ID (e.g. `G-XXXXXXXXXX`) |

Copy `.env.example` to `.env` and set your own values before running locally.

### Cloudflare Pages

In the Cloudflare Pages dashboard, set the environment variable under:

**Settings → Environment Variables → Add variable**

| Variable | Value |
| :------- | :---- |
| `PUBLIC_GA_ID` | Your GA4 measurement ID |

## Running Tests

End-to-end tests are written with [Playwright](https://playwright.dev). Start the dev server first, then run:

```sh
npx playwright test
```

Test files are in the `tests/` directory.

## Contributing

Issues and pull requests are welcome. Please open an issue to discuss larger changes before submitting a PR.
