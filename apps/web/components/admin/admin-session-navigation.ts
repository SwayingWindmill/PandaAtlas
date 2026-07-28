export function adminSessionFailureDestination(status: number | undefined): string | null {
  if (status === 401) {
    return "/auth/login?next=%2Fadmin";
  }
  if (status === 403 || status === 404) {
    return "/";
  }
  return null;
}
