import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4321';
const PAGE = `${BASE}/k8s-rbac-visualizer`;

async function mockClipboard(page: Page) {
  await page.addInitScript(() => {
    let _stored = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => { _stored = t; return Promise.resolve(); },
        readText: () => Promise.resolve(_stored),
      },
      configurable: true,
      writable: true,
    });
  });
}

async function visualize(page: Page, yaml: string) {
  await page.fill('#rbacInput', yaml);
  await page.click('#visualizeBtn');
}

async function expandSubject(page: Page, subjectName: string) {
  const card = page.locator('.subject-card', { hasText: subjectName });
  await card.locator('.subject-toggle').click();
  return card;
}

test.describe('Kubernetes RBAC Visualizer', () => {
  test.beforeEach(async ({ page }) => {
    await mockClipboard(page);
    await page.goto(PAGE);
  });

  test('1. loads with empty state', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('RBAC Effective Permissions Visualizer');
    await expect(page.locator('#resultsCard')).toBeHidden();
  });

  test('2. basic Role + RoleBinding in one namespace grants correct permission', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: staging
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: staging
subjects:
  - kind: ServiceAccount
    name: staging-app
    namespace: staging
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
`);
    await expect(page.locator('#resultsCard')).toBeVisible();
    const card = await expandSubject(page, 'staging-app');
    await expect(card).toContainText('Namespace: staging');
    await expect(card).toContainText('core/pods');
    await expect(card).toContainText('get, list, watch');
    await expect(card).toContainText('RoleBinding/pod-reader-binding');
  });

  test('3. RoleBinding to a ClusterRole is namespace-scoped, not cluster-wide (Gotcha A)', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: secret-admin-cluster
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: secret-admin-in-staging
  namespace: staging
subjects:
  - kind: User
    name: alice@example.com
roleRef:
  kind: ClusterRole
  name: secret-admin-cluster
  apiGroup: rbac.authorization.k8s.io
`);
    const card = await expandSubject(page, 'alice@example.com');
    // Must appear scoped to the staging namespace only.
    await expect(card).toContainText('Namespace: staging');
    await expect(card).not.toContainText('Cluster-wide');
    await expect(card).toContainText('via ClusterRole — namespace-scoped only');
  });

  test('4. ClusterRoleBinding grants cluster-wide access correctly', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-viewer
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-viewer-binding
subjects:
  - kind: Group
    name: sre-team
roleRef:
  kind: ClusterRole
  name: node-viewer
  apiGroup: rbac.authorization.k8s.io
`);
    const card = await expandSubject(page, 'sre-team');
    await expect(card).toContainText('Cluster-wide (all namespaces)');
    await expect(card).toContainText('core/nodes');
    await expect(card).toContainText('ClusterRoleBinding/node-viewer-binding');
  });

  test('5. aggregated ClusterRole merges rules when target is present in input (Gotcha B)', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-aggregate
  labels:
    rbac.example.com/aggregate-to-monitoring: "true"
aggregationRule:
  clusterRoleSelectors:
    - matchLabels:
        rbac.example.com/aggregate-to-monitoring: "true"
rules: []
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: metrics-reader
  labels:
    rbac.example.com/aggregate-to-monitoring: "true"
rules:
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-team-binding
subjects:
  - kind: Group
    name: monitoring-team
roleRef:
  kind: ClusterRole
  name: monitoring-aggregate
  apiGroup: rbac.authorization.k8s.io
`);
    const card = await expandSubject(page, 'monitoring-team');
    await expect(card).toContainText('metrics.k8s.io/pods');
    await expect(card).toContainText('get, list');
    await expect(page.locator('#rbacWarning')).toBeHidden();
  });

  test('6. aggregated ClusterRole warns when aggregation target is missing from input (Gotcha B)', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: monitoring-aggregate
  labels:
    rbac.example.com/aggregate-to-monitoring: "true"
aggregationRule:
  clusterRoleSelectors:
    - matchLabels:
        rbac.example.com/aggregate-to-monitoring: "true"
rules: []
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-team-binding
subjects:
  - kind: Group
    name: monitoring-team
roleRef:
  kind: ClusterRole
  name: monitoring-aggregate
  apiGroup: rbac.authorization.k8s.io
`);
    await expect(page.locator('#rbacWarning')).toBeVisible();
    await expect(page.locator('#rbacWarning')).toContainText('none found in your input');
    // No permissions should be silently fabricated for the missing aggregation target.
    await expect(page.locator('#resultsCard')).toBeHidden();
  });

  test('7. wildcard resources and verbs expand to "All", not literal strings', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-admin-like
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admins-binding
subjects:
  - kind: User
    name: root-admin
roleRef:
  kind: ClusterRole
  name: cluster-admin-like
  apiGroup: rbac.authorization.k8s.io
`);
    const card = await expandSubject(page, 'root-admin');
    await expect(card).toContainText('All resources (*)');
    await expect(card).toContainText('All verbs (*)');
  });

  test('8. resourceNames scoping is surfaced, not shown as blanket access', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: configmap-reader
  namespace: staging
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get"]
    resourceNames: ["app-config"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: configmap-reader-binding
  namespace: staging
subjects:
  - kind: ServiceAccount
    name: staging-app
    namespace: staging
roleRef:
  kind: Role
  name: configmap-reader
  apiGroup: rbac.authorization.k8s.io
`);
    const card = await expandSubject(page, 'staging-app');
    await expect(card).toContainText('scoped to: app-config');
  });

  test('9. malformed/incomplete YAML shows clear error, no crash', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: broken-binding
  namespace: staging
subjects:
  - kind: ServiceAccount
    name: staging-app
roleRef:
  kind: Role
  name: does-not-exist
  apiGroup: rbac.authorization.k8s.io
---
this is: [not, valid, yaml:::
`);
    await expect(page.locator('#rbacError')).toBeVisible();
    await expect(page.locator('#rbacWarning')).toBeVisible();
    await expect(page.locator('#rbacWarning')).toContainText('not found in your input');
    // Page must not crash — the input and buttons remain interactive.
    await expect(page.locator('#visualizeBtn')).toBeEnabled();
  });

  test('10. malformed kind is flagged clearly, not silently skipped', async ({ page }) => {
    await visualize(page, `
apiVersion: v1
kind: NotARealKind
metadata:
  name: whatever
`);
    await expect(page.locator('#rbacError')).toBeVisible();
    await expect(page.locator('#rbacError')).toContainText('unrecognized or missing "kind"');
  });

  test('11. permalink round-trip: encode input, load fresh, identical output renders', async ({ page }) => {
    const yaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: staging
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: staging
subjects:
  - kind: ServiceAccount
    name: staging-app
    namespace: staging
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
`;
    await visualize(page, yaml);
    await page.click('#copyLinkBtn');
    await expect(page.locator('#copyLinkBtn')).toContainText('Copied');

    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain('?y=');

    await page.goto(link);
    await expect(page.locator('#resultsCard')).toBeVisible();
    const card = await expandSubject(page, 'staging-app');
    await expect(card).toContainText('core/pods');
    await expect(card).toContainText('get, list');
  });

  test('12. multiple bindings granting the same permission are all listed', async ({ page }) => {
    await visualize(page, `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader-a
  namespace: staging
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader-b
  namespace: staging
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: binding-a
  namespace: staging
subjects:
  - kind: User
    name: bob@example.com
roleRef:
  kind: Role
  name: pod-reader-a
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: binding-b
  namespace: staging
subjects:
  - kind: User
    name: bob@example.com
roleRef:
  kind: Role
  name: pod-reader-b
  apiGroup: rbac.authorization.k8s.io
`);
    const card = await expandSubject(page, 'bob@example.com');
    await expect(card).toContainText('Role/pod-reader-a');
    await expect(card).toContainText('Role/pod-reader-b');
  });

  test('13. Load example button populates input and renders results', async ({ page }) => {
    await page.click('#loadExampleBtn');
    await expect(page.locator('#resultsCard')).toBeVisible();
    await expect(page.locator('#resultsBody .subject-card')).toHaveCount(3);
  });

  test('14. subject search filter narrows results', async ({ page }) => {
    await page.click('#loadExampleBtn');
    await expect(page.locator('#resultsBody .subject-card')).toHaveCount(3);
    await page.fill('#subjectSearch', 'alice');
    const visibleCards = page.locator('.subject-card:visible');
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.first()).toContainText('alice@example.com');
  });
});
