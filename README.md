# OpsBash

Free DevOps tools that run entirely in your browser — no login, no tracking, no server.

**Live site:** [https://opsbash.com](https://opsbash.com)

---

## Tools

| Tool | URL | Description |
|------|-----|-------------|
| Cron Builder | [/cron-builder](https://opsbash.com/cron-builder) | Build and validate cron expressions with a visual editor |
| CIDR Calculator | [/cidr-calculator](https://opsbash.com/cidr-calculator) | Subnet masks, CIDR ranges, broadcast addresses |
| JWT Decoder | [/jwt-decoder](https://opsbash.com/jwt-decoder) | Decode JWT tokens and inspect claims |
| JSON ↔ YAML Converter | [/json-yaml-converter](https://opsbash.com/json-yaml-converter) | Convert between JSON and YAML in real time |
| Chmod Calculator | [/chmod-calculator](https://opsbash.com/chmod-calculator) | Octal, symbolic, and chmod command output |
| .gitignore Generator | [/gitignore-generator](https://opsbash.com/gitignore-generator) | Generate .gitignore files for any stack |
| Docker Compose Converter | [/docker-compose](https://opsbash.com/docker-compose) | Convert docker run commands to Compose YAML |

---

## Tech Stack

- **[Astro JS](https://astro.build)** — static site framework
- **[Tailwind CSS](https://tailwindcss.com)** — utility-first CSS
- **[Cloudflare Pages](https://pages.cloudflare.com)** — hosting and CDN
- **[Playwright](https://playwright.dev)** — 170 end-to-end tests across all 7 tools
- **[GitHub Actions](https://github.com/features/actions)** — CI/CD pipeline

---

## Local Development

```bash
git clone https://github.com/rishmish/opsbash-cron.git
cd opsbash-cron
npm install
npm run dev
```

The dev server starts at `http://localhost:4321`.

---

## Testing

170 Playwright tests cover all 7 tools. Tests run in CI on every push and deployment is blocked on failure.

```bash
# Run all tests
npm run test

# Run tests for a specific tool
npm run test -- --grep "cron-builder"
```

---

## Deployment

Pushes to `master` trigger a GitHub Actions workflow that builds the site and deploys to Cloudflare Pages. Deployment only proceeds if all 170 tests pass.

---

## Support

If OpsBash saves you time, consider buying me a coffee:

[https://ko-fi.com/rishmish](https://ko-fi.com/rishmish)

---

## License

MIT
