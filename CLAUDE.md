## Database

- This Project uses turso's libsql, but we're not deployed on turso and simply using sqlite file mounted to a volume.
- libsql driver returns promises so most db calls should be awaited.

## UI & Styling

- Use tailwind, heroicons for icons and solid-motionone for animations
