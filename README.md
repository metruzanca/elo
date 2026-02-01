# Solidstart quickstart template

## Usage

```
bunx degit metruzanca/quick-solidstart
```

## Tech Stack

- Deploy on railway, add a volume for persistance at `/app/drizzle/data/`.
- Solid & Solidstart for UI and server actions
- Tailwind for styling, Heroicons for icons, solid-motionone for animations, daisyui for prebuild styles

## Note on libsql

By default, the "solid-start with drizzle" template installs `better-sqlite3`. However, `better-sqlite3` requires a native (non-JavaScript) dependency, which means if you want to deploy this app to a platform like Railway, you'll need to create a custom Dockerfile to install that dependency. On the other hand, `libsql` is a pure JavaScript solution that works out of the box, and it also makes it easy to transition to Turso with minimal changes.
