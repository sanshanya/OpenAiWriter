import { cookies } from "next/headers";
import { WorkspacePage } from "./page-client";

function parseSidebarCookie(value: string | undefined, fallback = true) {
  if (value === undefined) return fallback;
  return value === "true";
}

export default async function Page() {
  const cookieStore = await cookies();
  const defaultLeftOpen = parseSidebarCookie(
    cookieStore.get("left_sidebar_state")?.value,
    true
  );
  const defaultRightOpen = parseSidebarCookie(
    cookieStore.get("right_sidebar_state")?.value,
    true
  );

  return (
    <WorkspacePage
      defaultLeftOpen={defaultLeftOpen}
      defaultRightOpen={defaultRightOpen}
    />
  );
}
