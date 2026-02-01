// @refresh reload
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <>
          <div class="navbar bg-base-200">
            <div class="navbar-start">
              <a href="/" class="btn btn-ghost text-xl">
                Index
              </a>
            </div>
            <div class="navbar-end">
              <a href="/about" class="btn btn-ghost">
                About
              </a>
            </div>
          </div>
          <Suspense>{props.children}</Suspense>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
