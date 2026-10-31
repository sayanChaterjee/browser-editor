import ContestRoom from "@/components/contest/ContestRoom";

export default async function ContestRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContestRoom contestId={id} />;
}
