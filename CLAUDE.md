## Database

- This Project uses turso's libsql, but we're not deployed on turso and simply using sqlite file mounted to a volume.
- libsql driver returns promises so most db calls should be awaited.
- **Never import `db` or `@/db` directly in route components or any files that end up in the client bundle.** Database access should only happen in server-side API functions (`src/api/*.ts` files marked with `"use server"`). Route components should call API functions instead of accessing the database directly.

## UI & Styling

- Use tailwind, heroicons for icons and solid-motionone for animations

## Imports

- `~/` alias resolves to src/
- `@/` alias resolves to drizzle/ (use for db access)
