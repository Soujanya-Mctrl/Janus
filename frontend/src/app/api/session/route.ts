import { sessionResponse } from "../../../lib/session-response.mjs";

export async function GET(request: Request) { return sessionResponse(request); }
