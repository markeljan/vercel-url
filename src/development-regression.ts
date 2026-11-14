import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type Case = { name: string; env: Record<string, string>; expected: string };
const cases: Case[] = [
  { name: "plain local", env: {}, expected: "http://localhost:3000" },
  {
    name: "plain local port",
    env: { PORT: "4321" },
    expected: "http://localhost:4321",
  },
  {
    name: "system development port",
    env: { VERCEL_ENV: "development", PORT: "4321" },
    expected: "http://localhost:4321",
  },
  {
    name: "system development tunnel",
    env: {
      VERCEL: "1",
      VERCEL_ENV: "development",
      TUNNEL_URL: "dev.example.test",
    },
    expected: "https://dev.example.test",
  },
  {
    name: "development ignores remote URL",
    env: {
      VERCEL_ENV: "development",
      VERCEL_URL: "old.example.test",
      PORT: "4321",
    },
    expected: "http://localhost:4321",
  },
  {
    name: "target development",
    env: { VERCEL_TARGET_ENV: "development", PORT: "4321" },
    expected: "http://localhost:4321",
  },
  {
    name: "explicit HTTP tunnel preserved",
    env: {
      VERCEL_ENV: "development",
      TUNNEL_URL: "http://dev.example.test:4321",
    },
    expected: "http://dev.example.test:4321",
  },
  {
    name: "preview branch priority",
    env: {
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "branch.example.test",
      VERCEL_URL: "deploy.example.test",
      TUNNEL_URL: "local.example.test",
    },
    expected: "https://branch.example.test",
  },
  {
    name: "preview deployment fallback",
    env: { VERCEL_ENV: "preview", VERCEL_URL: "deploy.example.test" },
    expected: "https://deploy.example.test",
  },
  {
    name: "production domain priority",
    env: {
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "prod.example.test",
      VERCEL_URL: "deploy.example.test",
      TUNNEL_URL: "local.example.test",
    },
    expected: "https://prod.example.test",
  },
  {
    name: "production deployment fallback",
    env: { VERCEL_ENV: "production", VERCEL_URL: "deploy.example.test" },
    expected: "https://deploy.example.test",
  },
  {
    name: "environment priority over target",
    env: {
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "development",
      VERCEL_URL: "preview.example.test",
    },
    expected: "https://preview.example.test",
  },
  {
    name: "custom target fallback",
    env: { VERCEL_TARGET_ENV: "staging", VERCEL_URL: "staging.example.test" },
    expected: "https://staging.example.test",
  },
  {
    name: "unspecified Vercel fallback preserved",
    env: { VERCEL: "1" },
    expected: "https://localhost:3000",
  },
];
for (const prefix of [
  "NEXT_PUBLIC_",
  "NUXT_ENV_",
  "REACT_APP_",
  "GATSBY_",
  "VITE_",
  "PUBLIC_",
  "VUE_APP_",
  "REDWOOD_ENV_",
  "SANITY_STUDIO_",
]) {
  cases.push({
    name: `${prefix} development`,
    env: {
      [`${prefix}VERCEL_ENV`]: "development",
      VERCEL_ENV: "production",
      PORT: "4321",
    },
    expected: "http://localhost:4321",
  });
}

type BrowserCase = {
  name: string;
  defines: Record<string, string>;
  expected: string;
};
const viteDefines = (values: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ])
  );
const browserCases: BrowserCase[] = [
  {
    name: "browser Vite tunnel define",
    defines: viteDefines({ VITE_TUNNEL_URL: "dev.example.test" }),
    expected: "https://dev.example.test",
  },
  {
    name: "browser no-value control",
    defines: {},
    expected: "http://localhost:3000",
  },
  {
    name: "browser Vite preview branch URL",
    defines: viteDefines({
      VITE_VERCEL_ENV: "preview",
      VITE_VERCEL_BRANCH_URL: "branch.example.test",
      VITE_VERCEL_URL: "deploy.example.test",
    }),
    expected: "https://branch.example.test",
  },
  {
    name: "browser Vite preview falls back to deployment URL",
    defines: viteDefines({
      VITE_VERCEL_ENV: "preview",
      VITE_VERCEL_URL: "deploy.example.test",
    }),
    expected: "https://deploy.example.test",
  },
  {
    name: "browser Vite production project URL",
    defines: viteDefines({
      VITE_VERCEL_ENV: "production",
      VITE_VERCEL_PROJECT_PRODUCTION_URL: "prod.example.test",
      VITE_VERCEL_URL: "deploy.example.test",
    }),
    expected: "https://prod.example.test",
  },
  {
    name: "browser Vite production deployment fallback",
    defines: viteDefines({
      VITE_VERCEL_ENV: "production",
      VITE_VERCEL_URL: "deploy.example.test",
    }),
    expected: "https://deploy.example.test",
  },
  {
    name: "browser Vite target env fallback",
    defines: viteDefines({
      VITE_VERCEL_TARGET_ENV: "production",
      VITE_VERCEL_PROJECT_PRODUCTION_URL: "prod.example.test",
    }),
    expected: "https://prod.example.test",
  },
  {
    name: "browser Vite env priority over target env",
    defines: viteDefines({
      VITE_VERCEL_ENV: "preview",
      VITE_VERCEL_TARGET_ENV: "production",
      VITE_VERCEL_BRANCH_URL: "branch.example.test",
      VITE_VERCEL_PROJECT_PRODUCTION_URL: "prod.example.test",
    }),
    expected: "https://branch.example.test",
  },
  {
    name: "browser Vite explicit protocol preserved",
    defines: viteDefines({
      VITE_VERCEL_ENV: "preview",
      VITE_VERCEL_BRANCH_URL: "http://branch.example.test:4321",
    }),
    expected: "http://branch.example.test:4321",
  },
  {
    name: "browser Vite development tunnel",
    defines: viteDefines({
      VITE_VERCEL_ENV: "development",
      VITE_TUNNEL_URL: "dev.example.test",
      VITE_VERCEL_URL: "old.example.test",
    }),
    expected: "https://dev.example.test",
  },
];

function runBrowserCase(test: BrowserCase, entry: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), "vercel-url-browser-"));
  try {
    const args = [
      "build",
      entry,
      "--outdir",
      dir,
      "--target=browser",
      "--format=esm",
    ];
    for (const [key, value] of Object.entries(test.defines)) {
      args.push("--define", `${key}=${value}`);
    }
    const built = spawnSync(process.execPath, args, {
      cwd: dir,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: "pipe",
    });
    let actual = "";
    let pass = false;
    if (built.status === 0) {
      const bundle = join(dir, "index.js");
      // Run with no global process, from an empty directory with no env/dotenv.
      const run = spawnSync(
        process.execPath,
        [
          "--no-env-file",
          "-e",
          `delete globalThis.process; const m = await import(${JSON.stringify(bundle)}); console.log(m.DEPLOYMENT_URL);`,
        ],
        {
          cwd: dir,
          env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
          stdio: "pipe",
        }
      );
      actual = run.stdout.toString().trim();
      pass = run.status === 0 && actual === test.expected;
    }
    console.log(
      `${pass ? "PASS" : "FAIL"} ${test.name}: ${actual} (expected ${test.expected})`
    );
    return pass;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let root: string | undefined;
try {
  let entry = resolve(process.cwd(), "src/index.ts");
  if (process.argv.includes("--bundle")) {
    root = mkdtempSync(join(tmpdir(), "vercel-url-regression-"));
    const result = spawnSync(process.execPath, [
      "build",
      entry,
      "--outdir",
      root,
      "--target=node",
    ]);
    if (result.status !== 0) {
      throw new Error("Bundle build failed");
    }
    entry = join(root, "index.js");
  }
  let failures = 0;
  for (const test of cases) {
    const run = spawnSync(
      process.execPath,
      [
        "-e",
        `const m = await import(${JSON.stringify(entry)}); console.log(m.DEPLOYMENT_URL);`,
      ],
      {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", ...test.env },
        stdio: "pipe",
      }
    );
    const actual = run.stdout.toString().trim();
    const pass = run.status === 0 && actual === test.expected;
    console.log(
      `${pass ? "PASS" : "FAIL"} ${test.name}: ${actual} (expected ${test.expected})`
    );
    if (!pass) {
      failures++;
    }
  }
  for (const test of browserCases) {
    if (!runBrowserCase(test, resolve(process.cwd(), "src/index.ts"))) {
      failures++;
    }
  }
  const total = cases.length + browserCases.length;
  console.log(`${total - failures}/${total} cases passed`);
  if (failures) {
    console.error("DEVELOPMENT_URL_REGRESSION");
    process.exitCode = 1;
  }
} finally {
  if (root) {
    rmSync(root, { recursive: true, force: true });
  }
}

import { spawnSync } from "node:child_process";
