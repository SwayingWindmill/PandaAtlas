export interface AuthUserDeletionError {
  status?: number;
  code?: string;
}

/** GoTrue answers 404 once the user, their sessions, and their factors are already gone. */
export function authUserAlreadyGone(error: AuthUserDeletionError): boolean {
  return error.status === 404 || error.code === "user_not_found";
}

export interface AuthUserDeletion {
  /** Removes the Supabase Auth user. A second call, after the user is gone, succeeds. */
  deleteUser(userId: string): Promise<void>;
}

export const AUTH_USER_DELETION = Symbol("AUTH_USER_DELETION");
