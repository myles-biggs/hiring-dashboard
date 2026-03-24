import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      // Type-aware rules: downgraded to warnings for gradual adoption
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            "Inline styles are disallowed; prefer Tailwind utilities or add a shared component prop/variant.",
        },
      ],
    },
  },
  // Prevent Prisma imports in client components
  {
    files: ["components/**/*.{ts,tsx}", "app/**/_components/**/*.{ts,tsx}"],
    ignores: ["**/*actions.ts", "**/*route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/utils/prisma", "@/lib/utils/prisma/*"],
              message:
                "CRITICAL: Never import Prisma/database code in client components. Move data fetching to Server Components or Server Actions.",
            },
          ],
        },
      ],
    },
  },
])

export default eslintConfig
