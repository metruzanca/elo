export default function NotFound() {
  return (
    <main class="w-full p-4 flex items-center justify-center min-h-screen">
      <div class="hero">
        <div class="hero-content text-center">
          <div class="max-w-md">
            <h1 class="text-5xl font-bold text-error mb-4">404</h1>
            <p class="text-xl mb-6">Page Not Found</p>
            <a href="/" class="btn btn-primary">
              Go Home
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
