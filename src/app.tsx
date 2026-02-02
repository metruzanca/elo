// @refresh reload
import { Router, useLocation } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, Show } from "solid-js";
import { createAsync } from "@solidjs/router";
import { getUser, getUserGroups, getUserActiveLobby, logout } from "~/api";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => {
        const location = useLocation();

        // Only fetch data when not on login page - check synchronously
        const shouldFetch = () => location.pathname !== "/login";

        const user = createAsync(
          () => (shouldFetch() ? getUser() : Promise.resolve(null)),
          { deferStream: true }
        );
        const groups = createAsync(
          () => (shouldFetch() ? getUserGroups() : Promise.resolve([])),
          { deferStream: true }
        );
        const activeLobby = createAsync(
          () => (shouldFetch() ? getUserActiveLobby() : Promise.resolve(null)),
          { deferStream: true }
        );

        return (
          <>
            <Show when={location.pathname !== "/login"}>
              <div class="navbar bg-base-200">
                <div class="navbar-start">
                  <a href="/" class="btn btn-ghost">
                    <img src="/favicon.svg" alt="Home" class="h-6 w-6" />
                  </a>
                  <Suspense
                    fallback={
                      <a href="/" class="btn btn-ghost text-xl">
                        Groups
                      </a>
                    }
                  >
                    <Show
                      when={groups() && groups()!.length === 1}
                      fallback={
                        <a href="/" class="btn btn-ghost text-xl">
                          Groups
                        </a>
                      }
                    >
                      <a
                        href={`/groups/${groups()![0].id}`}
                        class="btn btn-ghost text-xl"
                      >
                        {groups()![0].name || `Group ${groups()![0].id}`}
                      </a>
                    </Show>
                  </Suspense>
                  <Suspense fallback={null}>
                    <Show when={activeLobby()}>
                      {(lobby) => (
                        <a
                          href={`/lobbies/${lobby().id}`}
                          class="btn btn-ghost"
                        >
                          Active Lobby
                        </a>
                      )}
                    </Show>
                  </Suspense>
                </div>
                <div class="navbar-end">
                  <Suspense
                    fallback={
                      <div class="btn btn-ghost btn-circle avatar">
                        <div class="w-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
                          <span class="text-lg font-bold">U</span>
                        </div>
                      </div>
                    }
                  >
                    <div class="dropdown dropdown-end">
                      <div
                        tabindex="0"
                        role="button"
                        class="btn btn-ghost btn-circle avatar"
                      >
                        <div class="w-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
                          <span class="text-lg font-bold">
                            {user()?.username?.[0]?.toUpperCase() || "U"}
                          </span>
                        </div>
                      </div>
                      <ul
                        tabindex="0"
                        class="menu dropdown-content bg-base-100 border-2 border-base-300 rounded-box z-10 w-52 p-2 shadow-lg"
                      >
                        <li class="menu-title">
                          <span>{user()?.username}</span>
                        </li>
                        <li>
                          <form action={logout} method="post">
                            <button
                              type="submit"
                              class="w-full text-left text-error"
                            >
                              Logout
                            </button>
                          </form>
                        </li>
                      </ul>
                    </div>
                  </Suspense>
                </div>
              </div>
            </Show>
            <Suspense>{props.children}</Suspense>
          </>
        );
      }}
    >
      <FileRoutes />
    </Router>
  );
}
