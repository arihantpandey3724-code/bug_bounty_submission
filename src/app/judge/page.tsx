import { cookies } from "next/headers";
import { isJudgeAuthorizedServer } from "@/lib/judgeAuth";
import JudgeLoginForm from "./JudgeLoginForm";
import JudgeConsole from "./JudgeConsole";

export const dynamic = "force-dynamic";

export default async function JudgePortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("judge_token")?.value;
  const isAuthorized = isJudgeAuthorizedServer(token);

  if (!isAuthorized) {
    return <JudgeLoginForm />;
  }

  return <JudgeConsole />;
}
