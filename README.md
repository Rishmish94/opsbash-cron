# OpsBash

Free DevOps tools that run entirely in your browser — no login, no tracking, no server.

**Live site:** [https://opsbash.com](https://opsbash.com)

---

## Tools

| Tool | URL | Description |
|------|-----|-------------|
| Cron Builder | [/cron-builder](https://opsbash.com/cron-builder) | Generate and validate cron expressions for Linux, AWS, Kubernetes, and GitHub Actions |
| CIDR Calculator | [/cidr-calculator](https://opsbash.com/cidr-calculator) | Calculate subnet details, usable hosts, and network ranges for IPv4 and IPv6 |
| JWT Decoder | [/jwt-decoder](https://opsbash.com/jwt-decoder) | Decode JWT tokens and inspect header, payload, and expiry status instantly |
| JSON to YAML Converter | [/json-yaml-converter](https://opsbash.com/json-yaml-converter) | Convert between JSON and YAML in real time, bidirectional with error highlighting |
| chmod Calculator | [/chmod-calculator](https://opsbash.com/chmod-calculator) | Calculate Linux file permissions between octal, symbolic, and visual formats |
| gitignore Generator | [/gitignore-generator](https://opsbash.com/gitignore-generator) | Generate .gitignore files for any technology stack, download with one click |
| Docker Run to Compose | [/docker-compose-converter](https://opsbash.com/docker-compose-converter) | Convert docker run commands into docker-compose.yml and back |
| Timestamp Converter | [/timestamp-converter](https://opsbash.com/timestamp-converter) | Convert Unix timestamps to human-readable dates and back, with timezone support |
| JSON Diff and Schema Validator | [/json-diff](https://opsbash.com/json-diff) | Compare JSON files semantically and validate against schemas |
| Kubernetes Secret Decoder | [/k8s-secret-decoder](https://opsbash.com/k8s-secret-decoder) | Decode Kubernetes Secret YAML and convert .env files to K8s Secrets |
| Log Sanitiser and PII Redactor | [/log-sanitiser](https://opsbash.com/log-sanitiser) | Redact PII and sensitive data from logs before sharing with AI tools |
| Base64 Encoder/Decoder | [/base64](https://opsbash.com/base64) | Encode and decode Base64 strings, files, and images entirely in the browser |

---

## Tech Stack

- **[Astro JS](https://astro.build)** — static site framework
- **[Tailwind CSS](https://tailwindcss.com)** — utility-first CSS
- **[Cloudflare Pages](https://pages.cloudflare.com)** — hosting and CDN
- **[Playwright](https://playwright.dev)** — 263 end-to-end tests across the tools with dedicated test suites
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

263 Playwright tests cover the tools with dedicated test suites. Tests run in CI on every push and deployment is blocked on failure.

```bash
# Run all tests
npm run test

# Run tests for a specific tool
npm run test -- --grep "cron-builder"
```

---

## Deployment

Pushes to `master` trigger a GitHub Actions workflow that builds the site and deploys to Cloudflare Pages. Deployment only proceeds if all 263 tests pass.

---

## Support

If OpsBash saves you time, consider buying me a coffee:

[https://ko-fi.com/rishmish](https://ko-fi.com/rishmish)

---

## License

MIT
