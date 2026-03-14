import { handlers } from "@/auth";

const originalGET = handlers.GET;
const originalPOST = handlers.POST;

export async function GET(req: Request) {
  try {
    return await originalGET(req);
  } catch (error) {
    console.error("[AUTH GET ERROR]", error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    return await originalPOST(req);
  } catch (error) {
    console.error("[AUTH POST ERROR]", error);
    throw error;
  }
}
