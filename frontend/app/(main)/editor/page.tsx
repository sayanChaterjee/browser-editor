import EditorLayout from "@/components/editor/EditorLayout";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading Editor...</div>}>
      <EditorLayout />
    </Suspense>
  );
}
