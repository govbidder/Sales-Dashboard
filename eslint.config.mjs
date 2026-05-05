import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      // Newer rule from eslint-plugin-react-hooks v7+ that's overly aggressive
      // for common patterns (state init from external data, route-driven state).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "supabase/functions/**",
      "supabase/migrations/**",
      "next-env.d.ts",
    ],
  },
]

export default eslintConfig
