import { redirect } from "next/navigation";

// The editor became /practice (contests have their own pages); old links keep working
export default async function EditorRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of [value].flat()) if (v !== undefined) params.append(key, v);
  }
  const query = params.toString();
  redirect(query ? `/practice?${query}` : "/practice");
}
