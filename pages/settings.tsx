import { Html } from "@elysiajs/html";
import { Flash } from "../components/flash";
import { unused } from "../utils/misc";
import { siteName } from "../utils/site-name";
import { VERSION } from "../utils/version";
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

type DuplicateGroup = {
	fingerprint: string;
	tracks: {
		id: number;
		title: string;
		duration_seconds: number | null;
		file_path: string;
		album: string | null;
		artists: string[];
	}[];
};

const OK_MESSAGES: Record<string, string> = {
	profile: "Display name updated.",
	password: "Password changed.",
	"session-revoked": "Session revoked.",
	"sessions-revoked": "Other sessions signed out.",
	"user-updated": "User updated.",
	rescan: "Library rescan started.",
	dirs: "Directories updated.",
	"site-name": "Site name updated.",
	subsonic: "Subsonic access updated.",
	signups: "Sign-up settings updated.",
	anonymous: "Anonymous listening updated.",
	"anonymous-subsonic": "Anonymous streaming key updated.",
};

const ERROR_MESSAGES: Record<string, string> = {
	password: "Current password is incorrect, or new password is invalid.",
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

function formatDuration(seconds: number | null) {
	if (!seconds) return "--:--";
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SettingsPage({
	user,
	sessions,
	currentTokenHash,
	users,
	stats,
	subsonicPassword,
	signupConfig,
	fpcalcAvailable,
	duplicates,
	allowAnonymous,
	anonymousSubsonicPassword,
	ok,
	error,
}: {
	user: User;
	sessions: Session[];
	currentTokenHash: string;
	users?: AdminUser[];
	stats?: Stats;
	subsonicPassword: string | null;
	signupConfig?: { mode: "closed" | "open" | "allowlist"; emails: string[] };
	fpcalcAvailable?: boolean;
	duplicates?: DuplicateGroup[];
	allowAnonymous?: boolean;
	anonymousSubsonicPassword?: string | null;
	ok?: string;
	error?: string;
}) {
	return (
		<Layout title="Settings" active="settings">
			<main class="flex-1 flex flex-col p-4 sm:p-6 gap-6 max-w-3xl mx-auto w-full">
				<h1 class="text-xl font-bold font-display">Settings</h1>

				<Flash variant="ok" message={ok && (OK_MESSAGES[ok] ?? "Saved.")} />
				<Flash
					variant="error"
					message={error && (ERROR_MESSAGES[error] ?? "Something went wrong.")}
				/>

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
									<p
										class="text-xs text-muted"
										title="Client-reported; not verified against the connection"
									>
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

				<Card title="Streaming access">
					<p class="text-xs text-muted">
						An app-specific key for any Subsonic or OpenSubsonic client (DSub,
						Substreamer, Symfonium, Feishin, Amperfy, ...) to stream from this
						server. Use your email as the username. This is separate from your
						login password, so a leaked client never exposes your account.
					</p>
					<form
						class="flex flex-col gap-3"
						method="post"
						action="/settings/subsonic"
					>
						<div class="flex flex-col gap-1.5">
							<label for="subsonic_password" class={labelClass}>
								Streaming access key
							</label>
							<div class="flex gap-2">
								<input
									id="subsonic_password"
									name="subsonic_password"
									type="text"
									placeholder={subsonicPassword ? "" : "Not set"}
									value={subsonicPassword ?? ""}
									class={`${inputClass} flex-1`}
								/>
								<button
									type="button"
									data-copy-key="subsonic_password"
									class={secondaryButtonClass}
									title="Copy"
									aria-label="Copy"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<rect x="9" y="9" width="13" height="13" rx="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								</button>
								<button
									type="button"
									data-generate-key="subsonic_password"
									class={secondaryButtonClass}
									title="Generate"
									aria-label="Generate"
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<polyline points="23,4 23,10 17,10" />
										<polyline points="1,20 1,14 7,14" />
										<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
									</svg>
								</button>
							</div>
							<span class="text-xs text-subtle">
								Leave blank and save to disable streaming access.
							</span>
						</div>
						<button type="submit" class={`${primaryButtonClass} self-start`}>
							Save
						</button>
					</form>
				</Card>

				{user.is_admin && users && stats && (
					<Card title="Admin">
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
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
						<form
							class="flex flex-col gap-3"
							method="post"
							action="/settings/admin/site-name"
						>
							<div class="flex flex-col gap-1.5">
								<label for="site_name" class={labelClass}>
									Site name
								</label>
								<input
									id="site_name"
									name="site_name"
									type="text"
									required
									maxlength={60}
									value={siteName}
									class={inputClass}
								/>
							</div>
							<button type="submit" class={`${primaryButtonClass} self-start`}>
								Save site name
							</button>
						</form>

						<form
							class="flex flex-col gap-3"
							method="post"
							action="/settings/admin/dirs"
						>
							<div class="flex flex-col gap-1.5">
								<label for="music_dir" class={labelClass}>
									Music directory
								</label>
								<input
									id="music_dir"
									name="music_dir"
									type="text"
									required
									value={stats.musicDir}
									class={inputClass}
								/>
							</div>
							<div class="flex flex-col gap-1.5">
								<label for="data_dir" class={labelClass}>
									Data directory
								</label>
								<input
									id="data_dir"
									name="data_dir"
									type="text"
									required
									value={stats.dataDir}
									class={inputClass}
								/>
							</div>
							<button type="submit" class={`${primaryButtonClass} self-start`}>
								Save directories
							</button>
						</form>

						<form method="post" action="/settings/admin/rescan">
							<button
								type="submit"
								class={`${secondaryButtonClass} self-start`}
							>
								Rescan library
							</button>
						</form>

						<form
							class="flex items-center justify-between gap-4 border-t border-border pt-4"
							method="post"
							action="/settings/admin/anonymous"
						>
							<div>
								<p class="text-sm font-medium">Anonymous listening</p>
								<p class="text-xs text-muted">
									Let visitors browse and stream without signing in.
								</p>
							</div>
							<input
								type="hidden"
								name="allow_anonymous"
								value={(!allowAnonymous).toString()}
							/>
							<button type="submit" class={`${secondaryButtonClass} shrink-0`}>
								{allowAnonymous ? "Disable" : "Enable"}
							</button>
						</form>

						{allowAnonymous && (
							<form
								class="flex flex-col gap-3 border-t border-border pt-4"
								method="post"
								action="/settings/admin/anonymous-subsonic"
							>
								<p class="text-xs text-muted">
									A shared key for anonymous listeners to connect Subsonic or
									OpenSubsonic clients. Username is{" "}
									<span class="font-mono">anonymous</span>.
								</p>
								<div class="flex flex-col gap-1.5">
									<label for="anonymous_subsonic_password" class={labelClass}>
										Anonymous streaming key
									</label>
									<div class="flex gap-2">
										<input
											id="anonymous_subsonic_password"
											name="anonymous_subsonic_password"
											type="text"
											placeholder={anonymousSubsonicPassword ? "" : "Not set"}
											value={anonymousSubsonicPassword ?? ""}
											class={`${inputClass} flex-1`}
										/>
										<button
											type="button"
											data-copy-key="anonymous_subsonic_password"
											class={secondaryButtonClass}
											title="Copy"
											aria-label="Copy"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												aria-hidden="true"
											>
												<rect x="9" y="9" width="13" height="13" rx="2" />
												<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
											</svg>
										</button>
										<button
											type="button"
											data-generate-key="anonymous_subsonic_password"
											class={secondaryButtonClass}
											title="Generate"
											aria-label="Generate"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												aria-hidden="true"
											>
												<polyline points="23,4 23,10 17,10" />
												<polyline points="1,20 1,14 7,14" />
												<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
											</svg>
										</button>
									</div>
									<span class="text-xs text-subtle">
										Leave blank and save to disable anonymous streaming access.
									</span>
								</div>
								<button
									type="submit"
									class={`${primaryButtonClass} self-start`}
								>
									Save
								</button>
							</form>
						)}

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

						{signupConfig ? (
							<form
								class="flex flex-col gap-3 border-t border-border pt-4"
								method="post"
								action="/settings/admin/signups"
							>
								<p class="text-xs font-medium text-muted">Sign-ups</p>
								<div class="flex flex-col gap-1.5">
									<label for="signup_mode" class={labelClass}>
										Who can create an account
									</label>
									<select id="signup_mode" name="mode" class={inputClass}>
										<option
											value="closed"
											selected={signupConfig.mode === "closed"}
										>
											Disabled
										</option>
										<option
											value="open"
											selected={signupConfig.mode === "open"}
										>
											Anyone
										</option>
										<option
											value="allowlist"
											selected={signupConfig.mode === "allowlist"}
										>
											Specific emails
										</option>
									</select>
								</div>
								<div class="flex flex-col gap-1.5">
									<label for="allowed_emails" class={labelClass}>
										Allowed emails (one per line)
									</label>
									{/* biome-ignore format: textarea content is whitespace-sensitive */}
									<textarea id="allowed_emails" name="allowed_emails" rows="4" class={`${inputClass} disabled:opacity-50`} disabled={signupConfig.mode !== "allowlist"}>{signupConfig.emails.join("\n")}</textarea>
									<span class="text-xs text-subtle">
										Used only when "Specific emails" is selected.
									</span>
								</div>
								<button
									type="submit"
									class={`${primaryButtonClass} self-start`}
								>
									Save sign-up settings
								</button>
							</form>
						) : (
							""
						)}
					</Card>
				)}

				{user.is_admin && (
					<Card title="Duplicate tracks">
						{!fpcalcAvailable ? (
							<p class="text-xs text-muted">
								fpcalc is required to detect duplicate tracks but it is not
								found in the server.
							</p>
						) : duplicates && duplicates.length > 0 ? (
							<div class="flex flex-col gap-4">
								{duplicates.map((group) => (
									<div class="grid grid-cols-2 gap-3 border-b border-border/60 pb-4 last:border-0 last:pb-0">
										{group.tracks.map((t) => (
											<div class="bg-background border border-border rounded-md p-3 text-sm flex flex-col gap-1 min-w-0">
												<p class="font-medium truncate">{t.title}</p>
												<p class="text-xs text-muted truncate">
													{t.artists.join(", ") || "Unknown artist"}
													{t.album ? ` · ${t.album}` : ""}
												</p>
												<p class="text-xs text-subtle">
													{formatDuration(t.duration_seconds)}
												</p>
												<p class="text-xs text-subtle truncate">
													{t.file_path}
												</p>
											</div>
										))}
									</div>
								))}
							</div>
						) : (
							<p class="text-xs text-muted">No duplicate tracks found.</p>
						)}
					</Card>
				)}
				<p class="text-xs text-subtle text-center">
					{siteName} v{VERSION}
				</p>
			</main>
		</Layout>
	);
}
