import {
  useSubmission,
  useSearchParams,
  type RouteSectionProps,
  createAsync,
} from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import { loginOrRegister, checkDiscordConfigured } from "~/api";

export default function Login(props: RouteSectionProps) {
  const discordConfigured = createAsync(async () => checkDiscordConfigured(), {
    deferStream: true,
  });

  const loggingIn = useSubmission(loginOrRegister);
  const [searchParams] = useSearchParams();
  const [showDevLogin, setShowDevLogin] = createSignal(false);

  const redirectTo = () => (searchParams.redirectTo as string) ?? "/";
  const discordAuthUrl = () => {
    const url = `/api/auth/discord?redirectTo=${encodeURIComponent(
      redirectTo()
    )}`;
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "login.tsx:20",
        message: "discordAuthUrl computed",
        data: { url, redirectTo: redirectTo() },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    return url;
  };

  const errorMessage = () => {
    const error = searchParams.error;
    if (error === "discord_denied") return "Discord login was cancelled";
    if (error === "discord_failed")
      return "Discord login failed. Please try again.";
    if (error === "invalid_request")
      return "Invalid request. Please try again.";
    return null;
  };

  return (
    <main class="w-full p-4 flex items-center justify-center min-h-screen">
      <div class="card bg-base-100 shadow-xl w-full max-w-md">
        <div class="card-body">
          <h1 class="card-title text-2xl mb-4 justify-center">Login</h1>

          <Show when={errorMessage()}>
            <div class="alert alert-error mb-4" role="alert">
              <span>{errorMessage()}</span>
            </div>
          </Show>

          {/* Discord OAuth - Primary Option */}
          <Show
            when={discordConfigured()}
            fallback={
              <div class="alert alert-warning mb-4">
                <span>Discord login not configured. Use dev login below.</span>
              </div>
            }
          >
            {/* #region agent log */}
            {(() => {
              const configured = discordConfigured();
              fetch(
                "http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "login.tsx:46",
                    message: "Discord button render check",
                    data: { configured, url: discordAuthUrl() },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "run1",
                    hypothesisId: "E",
                  }),
                }
              ).catch(() => {});
              return null;
            })()}
            {/* #endregion */}
            <a
              href={discordAuthUrl()}
              class="btn btn-primary w-full gap-2"
              onClick={(e) => {
                // #region agent log
                fetch(
                  "http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "login.tsx:54",
                      message: "Discord button clicked",
                      data: {
                        href: discordAuthUrl(),
                        defaultPrevented: e.defaultPrevented,
                      },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "run1",
                      hypothesisId: "E",
                    }),
                  }
                ).catch(() => {});
                // #endregion
                e.preventDefault();
                window.location.href = discordAuthUrl();
              }}
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Continue with Discord
            </a>
          </Show>

          {/* Dev Login Toggle */}
          <div class="divider text-sm text-base-content/50">
            <button
              type="button"
              class="link link-hover text-sm"
              onClick={() => setShowDevLogin(!showDevLogin())}
            >
              {showDevLogin() ? "Hide" : "Show"} Dev Login
            </button>
          </div>

          {/* Username/Password Form - Fallback for Dev */}
          <Show when={showDevLogin()}>
            <form action={loginOrRegister} method="post" class="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo()} />
              <fieldset class="fieldset">
                <legend class="fieldset-legend">Login or Register?</legend>
                <label class="label cursor-pointer">
                  <span class="label-text">Login</span>
                  <input
                    type="radio"
                    name="loginType"
                    value="login"
                    checked={true}
                    class="radio radio-primary"
                  />
                </label>
                <label class="label cursor-pointer">
                  <span class="label-text">Register</span>
                  <input
                    type="radio"
                    name="loginType"
                    value="register"
                    class="radio radio-primary"
                  />
                </label>
              </fieldset>
              <div class="form-control">
                <label for="username-input" class="label">
                  <span class="label-text">Username</span>
                </label>
                <input
                  id="username-input"
                  name="username"
                  type="text"
                  placeholder="kody"
                  autocomplete="username"
                  class="input input-bordered"
                />
              </div>
              <div class="form-control">
                <label for="password-input" class="label">
                  <span class="label-text">Password</span>
                </label>
                <input
                  id="password-input"
                  name="password"
                  type="password"
                  placeholder="twixrox"
                  autocomplete="current-password"
                  class="input input-bordered"
                />
              </div>
              <div class="form-control mt-4">
                <button type="submit" class="btn btn-outline">
                  Dev Login
                </button>
              </div>
              <Show when={loggingIn.result}>
                <div class="alert alert-error" role="alert" id="error-message">
                  <span>{loggingIn.result!.message}</span>
                </div>
              </Show>
            </form>
          </Show>
        </div>
      </div>
    </main>
  );
}
