import { Suspense } from "react";
import PracticeWorkspace from "@/components/editor/PracticeWorkspace";

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeWorkspace />
    </Suspense>
  );
}
