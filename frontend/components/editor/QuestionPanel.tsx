export default function QuestionPanel() {
  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span>Question</span>
      </div>

      <div style={{ padding: "16px", overflow: "auto" }}>
        <img
          src="/questions/q1.png"
          alt="Question"
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}
