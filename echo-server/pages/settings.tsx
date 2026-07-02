import { Html } from "@elysiajs/html";
import { unused } from "../utils/misc";
import { Layout } from "./layout";

unused(Html);

type User = {
	id: number;
	name: string;
	email: string;
	is_verified: boolean;
	is_admin: boolean;
};

type Session = {
	id: number;
	token_hash: string;
	ip_address: string | null;
	user_agent: string | null;
	created_at: Date;
	last_active_at: Date;
};

type AdminUser = {
	id: number;
	name: string;
	email: string;
	is_admin: boolean;
	is_active: boolean;
};

type Stats = {
	tracks: number;
	albums: number;
	artists: number;
	users: number;
	musicDir: string;
	dataDir: string;
};

const OK_MESSAGES: Record<string, string> = {
	profile: "Display name updated.",
	password: "Password changed.",
	"session-revoked": "Session revoked.",
	"sessions-revoked": "Other sessions signed out.",
	"user-created": "User created.",
	"user-updated": "User updated.",
	rescan: "Library rescan started.",
};

const ERROR_MESSAGES: Record<string, string> = {
	password: "Current password is incorrect, or new password is invalid.",
	"user-create": "Could not create user (email may already be in use).",
	self: "You cannot change your own admin/active status here.",
	"last-admin": "Cannot remove the last active admin.",
};

function Card({
	title,
	children,
}: {
	title: string;
	children: JSX.Element | JSX.Element[];
}) {
	return (
		<div class="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4">
			<h2 class="text-sm font-semibold text-foreground">{title}</h2>
			{children}
		</div>
	);
}

const inputClass =
	"bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-accent";
const labelClass = "text-xs font-medium text-muted";
const primaryButtonClass =
	"rounded-md bg-accent text-accent-foreground text-sm font-medium px-4 py-2 transition-opacity hover:opacity-90 cursor-pointer";
const secondaryButtonClass =
	"rounded-md border border-border text-sm font-medium px-4 py-2 text-muted hover:text-foreground hover:bg-background transition-colors cursor-pointer";

function formatDate(d: Date) {
	return new Date(d).toLocaleString();
}

export function SettingsPage({
	user,
	sessions,
	currentTokenHash,
	users,
	stats,
	ok,
	error,
}: {
	user: User;
	sessions: Session[];
	currentTokenHash: string;
	users?: AdminUser[];
	stats?: Stats;
	ok?: string;
	error?: string;
}) {
	return (
		<Layout title="Echo — Settings" active="settings">
			<main class="flex-1 flex flex-col p-6 gap-6 max-w-3xl mx-auto w-full">
				<h1 class="text-xl font-bold font-display">Settings</h1>

				{ok && (
					<p class="text-xs text-accent bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
						{OK_MESSAGES[ok] ?? "Saved."}
					</p>
				)}
				{error && (
					<p class="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-md px-3 py-2">
						{ERROR_MESSAGES[error] ?? "Something went wrong."}
					</p>
				)}

				<Card title="Account">
					<form
						class="flex flex-col gap-3"
						method="post"
						action="/settings/profile"
					>
						<div class="flex flex-col gap-1.5">
							<label for="name" class={labelClass}>
								Display name
							</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								value={user.name}
								class={inputClass}
							/>
						</div>
						<button type="submit" class={`${primaryButtonClass} self-start`}>
							Save name
						</button>
					</form>

					<form
						class="flex flex-col gap-3 border-t border-border pt-4"
						method="post"
						action="/settings/password"
					>
						<div class="flex flex-col gap-1.5">
							<label for="current_password" class={labelClass}>
								Current password
							</label>
							<input
								id="current_password"
								name="current_password"
								type="password"
								autocomplete="current-password"
								required
								class={inputClass}
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<label for="new_password" class={labelClass}>
								New password
							</label>
							<input
								id="new_password"
								name="new_password"
								type="password"
								autocomplete="new-password"
								required
								class={inputClass}
							/>
							<span class="text-xs text-subtle">
								8+ chars, upper &amp; lower case, number, special character
							</span>
						</div>
						<button type="submit" class={`${primaryButtonClass} self-start`}>
							Change password
						</button>
					</form>
				</Card>

				<Card title="Sessions">
					<div class="flex flex-col gap-2">
						{sessions.map((s) => (
							<div class="flex items-center justify-between gap-4 text-sm border-b border-border/60 pb-2 last:border-0 last:pb-0">
								<div class="min-w-0">
									<p class="truncate">
										{s.user_agent ?? "Unknown device"}
										{s.token_hash === currentTokenHash && (
											<span class="ml-2 text-xs text-accent">This device</span>
										)}
									</p>
									<p class="text-xs text-muted">
										{s.ip_address ?? "Unknown IP"} · last active{" "}
										{formatDate(s.last_active_at)}
									</p>
								</div>
								{s.token_hash !== currentTokenHash && (
									<form
										method="post"
										action={`/settings/sessions/${s.id}/revoke`}
									>
										<button type="submit" class={secondaryButtonClass}>
											Revoke
										</button>
									</form>
								)}
							</div>
						))}
					</div>
					<form method="post" action="/settings/sessions/revoke-others">
						<button type="submit" class={`${secondaryButtonClass} self-start`}>
							Sign out other sessions
						</button>
					</form>
				</Card>

				{user.is_admin && users && stats && (
					<Card title="Admin">
						<div class="grid grid-cols-4 gap-4 text-sm">
							<div>
								<p class="text-xs text-muted">Tracks</p>
								<p class="font-semibold">{stats.tracks}</p>
							</div>
							<div>
								<p class="text-xs text-muted">Albums</p>
								<p class="font-semibold">{stats.albums}</p>
							</div>
							<div>
								<p class="text-xs text-muted">Artists</p>
								<p class="font-semibold">{stats.artists}</p>
							</div>
							<div>
								<p class="text-xs text-muted">Users</p>
								<p class="font-semibold">{stats.users}</p>
							</div>
						</div>
						<p class="text-xs text-muted">
							Music dir: {stats.musicDir} · Data dir: {stats.dataDir}
						</p>

						<form method="post" action="/settings/admin/rescan">
							<button
								type="submit"
								class={`${secondaryButtonClass} self-start`}
							>
								Rescan library
							</button>
						</form>

						<div class="flex flex-col gap-2 border-t border-border pt-4">
							{users.map((u) => (
								<div class="flex items-center justify-between gap-4 text-sm">
									<div class="min-w-0">
										<p class="truncate">{u.name}</p>
										<p class="text-xs text-muted truncate">{u.email}</p>
									</div>
									{u.id === user.id ? (
										<span class="text-xs text-subtle shrink-0">You</span>
									) : (
										<div class="flex items-center gap-2 shrink-0">
											<form
												method="post"
												action={`/settings/admin/users/${u.id}/admin`}
											>
												<input
													type="hidden"
													name="is_admin"
													value={(!u.is_admin).toString()}
												/>
												<button type="submit" class={secondaryButtonClass}>
													{u.is_admin ? "Demote" : "Promote"}
												</button>
											</form>
											<form
												method="post"
												action={`/settings/admin/users/${u.id}/active`}
											>
												<input
													type="hidden"
													name="is_active"
													value={(!u.is_active).toString()}
												/>
												<button type="submit" class={secondaryButtonClass}>
													{u.is_active ? "Deactivate" : "Activate"}
												</button>
											</form>
										</div>
									)}
								</div>
							))}
						</div>

						<form
							class="flex flex-col gap-3 border-t border-border pt-4"
							method="post"
							action="/settings/admin/users"
						>
							<p class="text-xs font-medium text-muted">Add user</p>
							<div class="flex gap-3">
								<div class="flex flex-col gap-1.5 flex-1">
									<label for="new_user_name" class={labelClass}>
										Name
									</label>
									<input
										id="new_user_name"
										name="name"
										type="text"
										required
										class={inputClass}
									/>
								</div>
								<div class="flex flex-col gap-1.5 flex-1">
									<label for="new_user_email" class={labelClass}>
										Email
									</label>
									<input
										id="new_user_email"
										name="email"
										type="email"
										required
										class={inputClass}
									/>
								</div>
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="new_user_password" class={labelClass}>
									Temporary password
								</label>
								<input
									id="new_user_password"
									name="password"
									type="password"
									autocomplete="new-password"
									required
									class={inputClass}
								/>
								<span class="text-xs text-subtle">
									8+ chars, upper &amp; lower case, number, special character
								</span>
							</div>
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" name="is_admin" value="true" />
								Make admin
							</label>
							<button type="submit" class={`${primaryButtonClass} self-start`}>
								Create user
							</button>
						</form>
					</Card>
				)}
			</main>
		</Layout>
	);
}
