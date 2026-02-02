import {
  createAsync,
  useSubmission,
  type RouteDefinition,
} from "@solidjs/router";
import { getUser, getUserGroups, createGroup, joinGroup } from "~/api";
import {
  createGroup as createGroupServer,
  joinGroup as joinGroupServer,
} from "~/api/groups";
import { For, Show, createSignal } from "solid-js";

export const route = {
  preload() {
    getUser();
    getUserGroups();
  },
} satisfies RouteDefinition;

export default function Home() {
  const user = createAsync(async () => getUser(), { deferStream: true });
  const groups = createAsync(async () => getUserGroups(), {
    deferStream: true,
  });
  const [showCreateGroup, setShowCreateGroup] = createSignal(false);
  const [showJoinGroup, setShowJoinGroup] = createSignal(false);
  const [inviteCode, setInviteCode] = createSignal("");
  const creatingGroup = useSubmission(createGroup);
  const joiningGroup = useSubmission(joinGroup);

  return (
    <main class="w-full p-4 max-w-4xl mx-auto">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-3xl text-primary">
            Welcome, {user()?.username}!
          </h2>
          <p class="text-base-content/70">Manage your Elo groups and lobbies</p>

          <div class="divider"></div>

          <div class="flex gap-4 flex-wrap">
            <button
              class="btn btn-primary"
              onclick={() => {
                setShowCreateGroup(true);
                setShowJoinGroup(false);
              }}
            >
              Create Group
            </button>
            <button
              class="btn btn-secondary"
              onclick={() => {
                setShowJoinGroup(true);
                setShowCreateGroup(false);
              }}
            >
              Join Group
            </button>
          </div>

          <Show when={showCreateGroup()}>
            <div class="card bg-base-200 mt-4">
              <div class="card-body">
                <h3 class="card-title">Create New Group</h3>
                <form
                  onsubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const result = await createGroupServer(formData);
                    if (result?.success) {
                      setShowCreateGroup(false);
                      window.location.reload();
                    } else {
                      alert(result?.error || "Failed to create group");
                    }
                  }}
                >
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">Group Name (optional)</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      placeholder="My Gaming Group"
                      class="input input-bordered"
                    />
                  </div>
                  <Show
                    when={creatingGroup.result && !creatingGroup.result.success}
                  >
                    <div class="alert alert-error mt-4">
                      <span>
                        {creatingGroup.result?.error ||
                          "Failed to create group"}
                      </span>
                    </div>
                  </Show>
                  <div class="form-control mt-4">
                    <button
                      type="submit"
                      class="btn btn-primary"
                      disabled={creatingGroup.pending}
                    >
                      {creatingGroup.pending ? "Creating..." : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Show>

          <Show when={showJoinGroup()}>
            <div class="card bg-base-200 mt-4">
              <div class="card-body">
                <h3 class="card-title">Join Group</h3>
                <form
                  onsubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const result = await joinGroupServer(formData);
                    if (result?.success) {
                      setShowJoinGroup(false);
                      setInviteCode("");
                      window.location.reload();
                    } else {
                      alert(result?.error || "Failed to join group");
                    }
                  }}
                >
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">Invite Code</span>
                    </label>
                    <input
                      type="text"
                      name="inviteCode"
                      placeholder="Enter invite code"
                      value={inviteCode()}
                      oninput={(e) => setInviteCode(e.currentTarget.value)}
                      class="input input-bordered"
                      required
                    />
                  </div>
                  <Show
                    when={joiningGroup.result && !joiningGroup.result.success}
                  >
                    <div class="alert alert-error mt-4">
                      <span>
                        {joiningGroup.result?.error || "Failed to join group"}
                      </span>
                    </div>
                  </Show>
                  <div class="form-control mt-4">
                    <button
                      type="submit"
                      class="btn btn-secondary"
                      disabled={joiningGroup.pending}
                    >
                      {joiningGroup.pending ? "Joining..." : "Join"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Show>

          <div class="divider"></div>

          <h3 class="text-xl font-semibold">Your Groups</h3>
          <Show
            when={groups() && groups()!.length > 0}
            fallback={
              <p class="text-base-content/70">
                You're not in any groups yet. Create or join one to get started!
              </p>
            }
          >
            <div class="grid gap-4 mt-4">
              <For each={groups()}>
                {(group) => (
                  <div class="card bg-base-200">
                    <div class="card-body">
                      <h4 class="card-title">
                        {group.name || `Group ${group.id}`}
                      </h4>
                      <p class="text-sm text-base-content/70">
                        Invite Code:{" "}
                        <code class="bg-base-300 px-2 py-1 rounded">
                          {group.inviteCode}
                        </code>
                      </p>
                      <div class="card-actions justify-end">
                        <a
                          href={`/groups/${group.id}`}
                          class="btn btn-primary btn-sm"
                        >
                          View Group
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </main>
  );
}
