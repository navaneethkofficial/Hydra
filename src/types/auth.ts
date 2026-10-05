import type { UserDto } from "./api";

/** Shape returned by the register and login endpoints. */
export interface AuthResultDto {
  user: UserDto;
  needsOnboarding: boolean;
}

/** Shape returned by `GET /api/auth/session`: who the session cookie belongs to, if anyone. */
export interface SessionDto {
  user: UserDto | null;
}
