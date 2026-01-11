---
name: warn-missing-dependencies
enabled: true
event: file
pattern: (import.*from\s+['"]dotenv['"]|import\s+.*from\s+['"]@vercel/node['"])
---

⚠️ **Missing dependency detected**

You're using a package that may not be installed in this project:

- `dotenv` - remember to run `npm install dotenv --save` in the server directory
- `@vercel/node` - this is only for Vercel deployment, not local development

For server/: `cd server && npm install dotenv --save`
For Vercel API: Dependencies are auto-installed during build.
