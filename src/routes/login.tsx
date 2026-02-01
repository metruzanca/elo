import { useSubmission, type RouteSectionProps } from "@solidjs/router";
import { Show } from "solid-js";
import { loginOrRegister } from "~/api";

export default function Login(props: RouteSectionProps) {
  const loggingIn = useSubmission(loginOrRegister);

  return (
    <main class="w-full p-4 flex items-center justify-center min-h-screen">
      <div class="card bg-base-100 shadow-xl w-full max-w-md">
        <div class="card-body">
          <h1 class="card-title text-2xl mb-4">Login</h1>
          <form action={loginOrRegister} method="post" class="space-y-4">
            <input
              type="hidden"
              name="redirectTo"
              value={props.params.redirectTo ?? "/"}
            />
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
            <div class="form-control mt-6">
              <button type="submit" class="btn btn-primary">
                Login
              </button>
            </div>
            <Show when={loggingIn.result}>
              <div class="alert alert-error" role="alert" id="error-message">
                <span>{loggingIn.result!.message}</span>
              </div>
            </Show>
          </form>
        </div>
      </div>
    </main>
  );
}
