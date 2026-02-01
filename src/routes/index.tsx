import { createAsync, type RouteDefinition } from "@solidjs/router";
import { getUser, logout } from "~/api";

export const route = {
  preload() {
    getUser();
  },
} satisfies RouteDefinition;

export default function Home() {
  const user = createAsync(async () => getUser(), { deferStream: true });
  return (
    <main class="w-full p-4">
      <div class="card bg-base-100 shadow-xl max-w-2xl mx-auto">
        <div class="card-body">
          <h2 class="card-title text-3xl text-primary">
            Hello {user()?.username}
          </h2>
          <h3 class="text-xl font-semibold text-secondary">Message board</h3>
          <div class="card-actions justify-end mt-4">
            <form action={logout} method="post">
              <button
                name="logout"
                type="submit"
                class="btn btn-outline btn-error"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
