import type { Request, Response, NextFunction } from "express";
import type { UserProfile } from "@humanizer/shared";
import { store } from "../db/store.js";

export interface AuthedRequest extends Request {
  user?: UserProfile;
}

/** Auth disabled — every request runs as the local default user. */
export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    req.user = await store.ensureLocalUser();
    next();
  } catch (err) {
    next(err);
  }
}
