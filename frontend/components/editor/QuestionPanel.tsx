export default function QuestionPanel() {
  return (
    <div className="w-full min-w-[320px] flex flex-col bg-[#1e1e1e] border-l border-[#333] overflow-hidden flex-1 h-full">
      <div className="h-9 px-3 flex items-center justify-between bg-[#020617] text-[#e5e7eb] text-[12px] font-medium border-b border-[#1e293b]">
        <span>Question</span>
      </div>

      <div className="p-4 overflow-auto">
        <img
          src="/questions/q1.png"
          alt="Question"
          className="w-full"
        />
      </div>
    </div>
  );
}
